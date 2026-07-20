# Character v1→v2 Migration — Design Spec

**Date:** 2026-07-14
**Status:** Draft (v1 foundation implemented; v2 pull-side pending)
**Scope:** `character/character.contract.smart.c`, `gamemaster-registry/gamemaster-registry.contract.smart.c`, a future `character-v2` contract, and the test suites
**Related:** `2026-07-12-registry-as-config-design.md`, `2026-05-03-character-contract-design.md`, `2026-05-06-gamemaster-registry-design.md`, `2026-07-11-character-reroll-economy-design.md`

---

## Motivation

A CIYAM AT cannot be upgraded in place — its bytecode is immutable and its codehash is the thing the dApp verifies. So "upgrading the Character contract" always means deploying a *new* contract (v2, new codehash) and moving a player's value and progression from the old one. This spec defines how that move happens without losing the player's investment (the attribute build) and without opening a duplication or XP-recycle hole.

The design splits responsibility deliberately:

- **v1 pushes assets** — you cannot *pull* a token; the holder must send it. So v1 liquidates everything it holds.
- **v2 pulls stats** — the build (attributes, level, skill points) is read cross-contract from v1's map, because v2's attribute model may differ and only v2 knows how to interpret it.

This keeps v1 frozen and final while leaving v2 free to redefine mechanics.

### Non-Goals

- No in-place upgrade of a deployed Character (impossible on AT — migration is always old→new).
- No attempt to make v1 aware of v2's rules. v1 only liquidates + exposes; v2 owns all interpretation.
- No automatic re-linking: the owner drives the flow (liquidate v1 → deploy/fund v2 → v2 imports).

---

## v1 foundation — IMPLEMENTED (2026-07-13/14)

The v1 side is complete and green. Recorded here as the fixed substrate v2 builds on.

### Enable switch (gamemaster registry)

`G_NEXT_CHARACTER_HASH` at `REGISTRY_BASE + 6`, owner-gated setter `M_SET_NEXT_CHARACTER_HASH` (method 7). **Non-zero opens the migration window**; `0` disables MIGRATE entirely. It holds the codehash of the next Character version — v1 does not currently validate against it (see *Decisions*), but v2 and the dApp use it as the canonical "current next version" pointer.

### Public character sheet (cross-contract readable)

Attributes already lived in `MAP_KEY1_ATTRIBUTES`. Level and skill points were memory-only; they are now mirrored into `MAP_KEY1_PROGRESSION` (`3`) at `k2 = 1` (level) and `k2 = 2` (skill points), republished by `publishProgression()` at the **end of every activation**. Cross-contract reads only observe committed state between activations, so an end-of-activation write is always current for a reader. `rerollCount` is deliberately **not** exposed (not needed by the migration model — see *Decisions*).

### `MIGRATE` (method `77`) — one-shot liquidation

Terminal player action. Gates, in order: sender is the creator; `G_NEXT_CHARACTER_HASH != 0` (else `ERR_MIGRATE_DISABLED`); not already `migrated`. Then it:

1. sets `migrated = TRUE`;
2. unregisters from the character-account registry;
3. sweeps **every inventory item** to the owner (enumerates the dense slot index; sends each token's full balance once — a stack's later slots read a 0 balance and are skipped);
4. sends **all XP** to the owner;
5. sends the **SIGNA balance** to the owner last (terminal, like `refund()`).

Everything goes to the **owner's EOA**, not to v2. This is the crux (see *Decisions*).

### Permanent inertness

Once `migrated`, every future activation runs `bounceTx()` — returns incoming SIGNA and all attached assets to the sender — and skips all post-loop effects. An AT can't truly self-destruct (`exit` only ends the current activation), so the `migrated` flag is the "off switch." There is no way back.

Character codehash after these changes (stable, no initializers): `9382558353444278049`.

---

## The v2 pull-import path — TO DESIGN

v2 is a new contract with a possibly-different attribute model, so most of this is deferred to when v2 is actually cut. What v1 guarantees to v2:

- v1's **build is readable** at fixed map keys while v1 exists on-chain (a migrated v1 is a frozen, readable tombstone): attributes at `MAP_KEY1_ATTRIBUTES[1..5]`, level at `MAP_KEY1_PROGRESSION[1]`, skill points at `MAP_KEY1_PROGRESSION[2]`.
- v1's **assets are in the owner's wallet** after MIGRATE (items + XP + SIGNA), for the owner to re-deposit into v2.

A v2 import would therefore:

1. Accept an owner-driven `IMPORT(oldCharacterAddress)` call, **one-shot** (a v2 `imported` flag), allowed only before the character is otherwise used.
2. **Authenticate the source**: `getCreatorOf(oldCharacterAddress) == getCreator()` (same owner) **and** `getCodeHashOf(oldCharacterAddress)` equals a *trusted previous* hash. The natural anchor is the registry's `G_CHARACTER_HASH` during the migration window (see *Hash lifecycle*) — v2 checks the source is `G_CHARACTER_HASH` while v2's own hash is `G_NEXT_CHARACTER_HASH`.
3. Read the source's public sheet via `getExtMapValue` and reconstruct its own state under v2 rules (it may remap attributes, rescale, re-derive level from the imported XP token balance, etc. — v2's call).
4. Accept the re-deposited items/XP through its normal deposit path. Note the **level-gating ordering trap**: a fresh v2 is low-level and its `receiveAssets()` would bounce high-`minLevel` equipment — so import must set level/attributes *before* (or while) accepting items, or route migration deposits through a trusted path that skips the gates for a `G_CHARACTER_HASH`-matching context.

Because assets land in the owner's wallet first (not pushed contract→contract), step 4 is just ordinary deposits the owner initiates — no special cross-contract asset plumbing on the v1 side.

---

## Hash lifecycle (gamemaster-run)

Two registry globals drive the whole window; the Gamemaster moves through three phases:

| Phase | `G_CHARACTER_HASH` | `G_NEXT_CHARACTER_HASH` | Effect |
|---|---|---|---|
| Normal (v1 only) | `h1` | `0` | MIGRATE off |
| Window open (v1→v2) | `h1` | `h2` | v1 MIGRATE enabled; v2 IMPORT trusts source == `h1` |
| Promote (v2 canonical) | `h2` | `0` | MIGRATE off again; v2 is the trusted version |

No separate "previous hash" key is needed: during the window `G_CHARACTER_HASH` *is* the source-trust anchor, and promotion overwrites it. The character-account registry's own trusted hash must be advanced to `h2` when v2 launches so v2 characters can register.

---

## Decisions (settled in design discussion)

1. **Assets go to the owner's EOA, not pushed to v2.** Rationale: it sidesteps *both* existing guards without relaxing them (`transferItem` blocks contract recipients *and* XP), gives the owner full trading control, and solves the old "can't move items char→char" limitation via the EOA hop. It also means v1 needs **no** target/codehash validation — all trust logic lives on the v2 import side.
2. **`rerollCount` is not migrated.** Rerolls are a v1-economy concept; v2 defines its own. Not exposed, not carried.
3. **Level + skill points are publicly readable** (this spec's v1 change) so v2 can pull the full sheet; attributes already were.
4. **One-shot, no way back.** `migrated` is permanent; the character is inert forever after. This is what makes MIGRATE a *move* (destroy source), not a *copy* — the anti-duplication guarantee.

### Accepted tradeoff — the recycle window

Because assets go to the owner, while a window is open (`G_NEXT_CHARACTER_HASH != 0`) an owner can liquidate one v1 character's XP to their EOA and re-deposit it into *another* v1 character (each source destroyed). So the Finding-3 anti-recycle lock ("XP can never leave a character") holds **airtight only while migration is closed**; during a window it relaxes to "XP leaves only by destroying its character." Judged acceptable: windows are gamemaster-controlled and short, and net XP is conserved (no duplication). If ever unwanted, the alternative is to make MIGRATE push to a verified v2 (`getCodeHashOf(target) == G_NEXT_CHARACTER_HASH`, same creator) instead of to the owner — at the cost of the owner's trading flexibility.

---

## Open questions (for the v2 cut)

1. **Import authentication anchor.** Use `G_CHARACTER_HASH` (current, during window) as the source-trust hash, as above? Or have the registry keep an explicit `G_PREV_CHARACTER_HASH`? Leaning: reuse `G_CHARACTER_HASH` (no new key; promotion handles it).
2. **Level-gate bypass on import.** Set build-then-accept-items in one IMPORT activation, or add a trusted deposit path that skips `minLevel`/stack gates when the depositing owner is importing? Depends on v2's `receiveAssets` shape.
3. **XP re-derivation vs. carried level.** v2 receives the XP token and could re-derive level from it under its own curve — but the player already spent skill points into attributes (which v2 also reads). v2 must reconcile "level from XP" against "already-allocated attributes + unspent skill points" to avoid double-granting. This is the core of v2's import math; design when v2's model is known.
4. **Stale tombstone reads.** v2 reads v1's map after v1 is `migrated` (frozen) — confirm the simulator/chain keeps a finished/inert AT's map readable indefinitely (expected: yes; ATs are never deleted).

---

## Rollout (when v2 is cut)

1. Build v2 with an owner-gated, one-shot `IMPORT(oldAddress)` (auth + pull + reconcile), plus its own deposit acceptance for migrated assets.
2. Gamemaster: set `G_NEXT_CHARACTER_HASH = h2` (window opens). Advance the character-account registry trusted hash to `h2`.
3. Players: `MIGRATE` v1 (assets → wallet) → deploy/fund v2 → v2 `IMPORT(v1)` → re-deposit assets.
4. Gamemaster: after the window, promote (`G_CHARACTER_HASH = h2`, `G_NEXT_CHARACTER_HASH = 0`).
5. Verify: v2 codehash stable and recorded for the dApp; migrated v1 tombstones remain readable; no double-grant in reconciliation.
