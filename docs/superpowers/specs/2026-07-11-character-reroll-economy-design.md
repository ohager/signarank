# Character Reroll Economy & Registry Cap — Design Spec

**Date:** 2026-07-11
**Status:** Approved (pending user review of this file)
**Scope:** Smart contracts only (`character/character.contract.smart.c`, `character-account-registry/character-account-registry.contract.smart.c`)
**Related:** `2026-05-03-character-contract-design.md`, `2026-05-06-gamemaster-registry-design.md`

---

## Motivation

`init()` randomly distributes 5 starting skill points across the 5 attributes via `getWeakRandomNumber()`. Today, nothing stops a player from deploying many Characters and keeping only the one with the best roll: `refund()` is unguarded and returns the *entire* contract balance on demand, so the existing 2 SIGNA `activationAmount` deters nothing — the only real cost of a discarded attempt is the fixed Signum AT-creation fee.

This also creates a UX problem independent of cheating: if an account can hold an unbounded number of Characters, there's no sane way to list/select "your characters" in a client, and the character-account-registry's `(creatorAccount, characterId)` index grows without bound.

This spec closes both gaps:

1. **Reroll Economy** — rerolling stays possible, but each reroll after the first burns real, non-refundable SIGNA.
2. **Commitment Lock** — the first `attack()` call permanently locks the Character; no more rerolling or plain refund after that point.
3. **Registry Cap** — an account may have at most 5 *committed* Characters at once, enforced by the character-account-registry.
4. **Seppuku** — a committed Character can be voluntarily retired to free a cap slot, with a full refund of its remaining balance (safe, because a committed Character can never reroll again).

### Non-Goals

- No cheat-detection on player-supplied attributes — random init stays, per the existing design deviation ([project_character_contract_design.md]).
- No centralized/admin gate on who may create a Character. The cap and burn are enforced by contract logic alone, not by any Gamemaster-controlled allow-list.
- No Character Activation Token / DeFi integration. A true burn (unspendable address) was chosen over a tradeable token or Gamemaster-treasury fee, to avoid introducing any beneficiary or added trust surface.
- No change to the Gamemaster-controlled values (Construct hash, item/effect definitions) already living on the registry.

---

## Mechanic 1: Reroll Economy

- `init()` is unchanged: the **first** roll is free beyond the existing `activationAmount` (2 SIGNA).
- A new **`REROLL`** message (owner-only, pre-commit only) re-runs the same random-distribution logic as `init()`:
  - Requires the transaction to carry **≥ 100 SIGNA**; if not, the message is a no-op (funds returned, attributes untouched).
  - Resets all 5 `MAP_KEY1_ATTRIBUTES` entries to 0, resets `skillPoints = 5`, and redistributes via the existing `while` loop.
  - Recomputes `maxHitpoints`, `maxInventorySlots`, sets `currentHitpoints = maxHitpoints` (full heal — it's effectively a fresh character).
  - Burns the full amount sent (whole transaction amount, not just the 100 SIGNA floor — see Open Items) to an unspendable "dead" address. No token, no treasury, nobody benefits.
  - If `committed == TRUE`, the message is rejected outright (funds returned, no reroll).
- `refund()` keeps its existing behavior (returns the full current balance) but gains a `committed == FALSE` guard. Pre-commit, it's the "I don't want to play this roll at all, give me my money back" exit. Post-commit, it always no-ops — `seppuku()` (Mechanic 4) is the only way out from there.

---

## Mechanic 2: Commitment Lock

New state: `long committed;` (init `FALSE`).

New constant in `character.contract.smart.c`: `#define CHAR_REGISTRY <character-account-registry account id>` — the character-account-registry's account, **distinct from** the existing `GAMEMASTER_REGISTRY` (`122344543654`) used for `senderIsConstruct()`. The Character contract talks to two separate singleton registries.

`attack()` gains a one-time gate on its **first** invocation:

```c
void attack(long constructId, long quantity, long assetId) {
    if (committed == FALSE) {
        long count = getExtMapValue(getCreator(), ZERO, CHAR_REGISTRY);
        if (count >= MAX_CHARACTERS_PER_ACCOUNT) {
            // cap reached: refuse to commit, return whatever was sent, stay uncommitted
            long amount = getAmount(currentTx.txId);
            if (amount > ZERO) { sendAmount(amount, currentTx.sender); }
            return;
        }
        committed = TRUE;
        sendMessage(registerCharacterMsg, CHAR_REGISTRY); // M_REGISTER_CHARACTER
    }
    // existing attack forwarding logic, unchanged
    ...
}
```

Once `committed == TRUE`, subsequent `attack()` calls skip the registration/cap branch entirely and behave exactly as today.

---

## Mechanic 3: Registry Cap

Changes to `character-account-registry.contract.smart.c`:

- **New counter slot**: `(creatorAccount, 0)` stores the count of committed Characters for that account. Key2 `0` is reserved for this purpose, mirroring the existing `(0, 0)` reservation for the trusted-hash slot — real Character account IDs are large chain-issued numbers and never collide with `0`.
- **`M_REGISTER_CHARACTER`** (existing, currently unused/unwired) now also enforces and increments the counter:

```c
case M_REGISTER_CHARACTER:
    long creator = getCreatorOf(currentTx.sender);
    long count = getMapValue(creator, ZERO);
    if (count < MAX_CHARACTERS_PER_ACCOUNT) {
        setMapValue(creator, ZERO, count + 1);
        setMapValue(creator, currentTx.sender, getCodeHashOf(currentTx.sender));
    }
    break;
```

  The registry enforces the cap defensively too (defense in depth), even though `attack()` already gates on a synchronous read before committing.

- **New `M_UNREGISTER_CHARACTER`**, gated the same way as `M_REGISTER_CHARACTER` (`isSenderCharacter()`):

```c
case M_UNREGISTER_CHARACTER:
    long creator = getCreatorOf(currentTx.sender);
    long count = getMapValue(creator, ZERO);
    if (count > ZERO) { setMapValue(creator, ZERO, count - 1); }
    setMapValue(creator, currentTx.sender, ZERO);
    break;
```

- `MAX_CHARACTERS_PER_ACCOUNT = 5`, defined identically in both contracts (matches the existing pattern of duplicated shared `#define`s across Character/Construct/Registry).

---

## Mechanic 4: Seppuku

New Character method, owner-only, **committed-characters only**:

```c
void seppuku() {
    if (committed == FALSE) { return; }
    sendMessage(unregisterCharacterMsg, CHAR_REGISTRY); // M_UNREGISTER_CHARACTER
    sendAmount(getCurrentBalance(), getCreator());
}
```

Safe to fully refund because reroll is impossible once `committed == TRUE` — there is nothing left to launder by committing-then-retiring. This is also how a player replaces one of their 5 committed Characters: retire one via `seppuku()`, then deploy + roll + commit a new one (paying the normal creation cost again).

---

## Message Codes (new)

| Contract | Code | Name                     | Layout                    |
|----------|------|--------------------------|----------------------------|
| Character | 3   | `REROLL`                 | none (amount carries cost) |
| Character | 6   | `SEPPUKU`                | none                        |
| Registry  | 3   | `M_UNREGISTER_CHARACTER` | none (sender identifies the Character) |

(`3` and `6` are currently unused in `character.contract.smart.c`'s method-code space; `3` is unused in the registry's.)

---

## Open Items (implementation-phase decisions)

1. **Burn address.** Needs a concrete, provably unspendable Signum account ID (e.g. account `0`, or another documented dead address). Not resolved here — research the correct constant during implementation and verify it's genuinely unspendable (not merely unused).
2. **Reroll excess handling.** Spec burns the *entire* amount sent with `REROLL`, not just the 100 SIGNA floor, to keep the logic simple (no change-making). If overpaying-by-accident turns out to be a real risk in practice, this can be revisited to refund the excess above 100 SIGNA — flagged here rather than decided, since it adds complexity for a marginal UX gain.
3. **Same-block registration race.** Two uncommitted Characters under the same owner both landing their first `attack()` in the same block could both read `count < 5` before either's `M_REGISTER_CHARACTER` message is processed (cross-AT messages resolve on a later tick), letting the cap be exceeded by a small margin in that rare case. Accepted as a minor, non-exploitable-at-scale limitation of the async AT messaging model — not fixed in this spec.
4. **`activationAmount` pragma.** Unchanged (2 SIGNA) — the 100 SIGNA reroll cost travels as a per-message transaction amount, not as part of the fixed deployment funding.

---

## UX Side Effect

Capping committed Characters at 5 per account also resolves the "how do I manage hundreds of characters" concern from the original brainstorm: since uncommitted (mid-reroll) Characters never get registered, a client only ever needs to list up to 5 registered Characters per account, regardless of how many reroll attempts happened along the way.

---

## Testing Strategy

### Character (`smartcontracts/character/`)

- `REROLL` pre-commit: burns the sent amount, re-randomizes attributes, recomputes `maxHitpoints`/`maxInventorySlots`, fully heals `currentHitpoints`.
- `REROLL` rejected when amount `< 100 SIGNA` — no state change, funds returned.
- `REROLL` rejected when `committed == TRUE` — no state change, funds returned.
- `refund()` works pre-commit (existing tests already cover this; add a regression test for the new guard).
- `refund()` no-ops post-commit.
- `attack()` first call: sets `committed = TRUE`, fires `M_REGISTER_CHARACTER` (assert via mock/registry state).
- `attack()` first call rejected when registry cap already at `MAX_CHARACTERS_PER_ACCOUNT` (mocked count) — stays uncommitted, funds returned.
- `attack()` subsequent calls: normal combat forwarding, no re-registration.
- `seppuku()` rejected pre-commit (no-op).
- `seppuku()` post-commit: fires `M_UNREGISTER_CHARACTER`, refunds full remaining balance.

### Registry (`smartcontracts/character-account-registry/`)

- `M_REGISTER_CHARACTER` increments the per-account counter and stores the `(creator, character) → codehash` entry.
- `M_REGISTER_CHARACTER` silently drops when the counter is already at `MAX_CHARACTERS_PER_ACCOUNT` (defense in depth).
- `M_UNREGISTER_CHARACTER` decrements the counter and clears the entry.
- Non-Character senders cannot call `M_REGISTER_CHARACTER` / `M_UNREGISTER_CHARACTER` (existing `isSenderCharacter()` gate, add coverage for the new method).

---

## Out of Scope (deferred)

- Character Activation Token / DeFi platform integration (considered, not chosen — see Non-Goals).
- Gamemaster-tunable burn amount or cap size (both are hardcoded constants for now; making them configurable via the registry is a possible future extension but adds a trust-surface question that wasn't resolved in this brainstorm).
- Frontend/UI changes for character listing and selection.
- Leveling / future skill-point sources (`allocateSkillPoint` remains dead code, unaffected by this spec).
