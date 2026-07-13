# Registry-as-Config & Codehash-Verifiable Character — Design Spec

**Date:** 2026-07-12
**Status:** Draft (pending user approval)
**Scope:** `character/character.contract.smart.c`, `gamemaster-registry/gamemaster-registry.contract.smart.c`, and both test suites
**Related:** `2026-05-03-character-contract-design.md`, `2026-05-06-gamemaster-registry-design.md`, `2026-07-11-character-reroll-economy-design.md`

---

## Motivation

Character configuration is split across two mechanisms with different trust properties:

| Value | Today | In codehash? | Tamperable by deployer? |
|---|---|---|---|
| `GAMEMASTER_REGISTRY` | `#define` | yes | no |
| `CHAR_REGISTRY` | `#define` | yes | no |
| construct hash | read from registry | no (indirect) | no |
| `xpTokenId` | initializable (deploy data) | **no** | **yes** |
| `constructorAccount` | initializable (deploy data) | **no** | **yes** |

Initializable values live in the AT's *data* pages, not its code, so they **do not affect `codeHashId`**. That is a cheat hole: a player can deploy a Character with the genuine bytecode (matching codehash) but a **rogue `xpTokenId`** (a token they can mint freely → free levels) or a rogue `constructorAccount`, and a dApp verifying only the codehash cannot tell.

**Principle this spec establishes:**

- **Game *rules* (numeric constants)** — `LEVEL_XP_BASE`, `DROP_BASE_CHANCE_PCT`, `ARMOR_PER_STAMINA`, `DODGE_*`, etc. — stay `#define`. They are baked into the codehash, which is exactly what makes them verifiable and immutable.
- **Deployment *identities* (addresses / token ids / accounts)** — `xpTokenId`, `constructorAccount`, `CHAR_REGISTRY`, construct hash — are sourced from the **gamemaster registry**, the single source of truth.
- **Exactly one root pointer stays a `#define`: `GAMEMASTER_REGISTRY`** (you cannot read the registry's address from the registry — it must bootstrap somewhere).

The payoff: the *only* identity baked into a Character's codehash is `GAMEMASTER_REGISTRY`. So **every genuine Character shares one codehash**, the dApp verifies it, and because all real config lives in the registry (which the Gamemaster controls), there is **no per-Character config left to tamper with**. A cheater who wants rogue values must point at a *different* registry → different `#define` → different codehash → rejected by the dApp. The anti-cheat is transitive: codehash pins the registry, the registry pins the values.

Side benefit: it removes the `#ifdef TESTBED const` injection for these values, so the production codehash is stable and is exactly what the dApp checks.

### Non-Goals

- No change to game-rule constants — they stay `#define` on purpose (verifiable rules).
- No change to item/effect definitions or the construct-hash mechanism already on the registry.
- No live re-reading of identities per activation (see Caching, below) — this is not meant to make `xpTokenId` mutable for a live Character.

---

## Registry changes (`gamemaster-registry`)

Add three Global keys in the existing `REGISTRY_BASE` namespace and their owner-gated setters, mirroring `G_CONSTRUCT_HASH`:

```c
#define G_XP_TOKEN            (REGISTRY_BASE + 3)
#define G_CONSTRUCTOR_ACCOUNT (REGISTRY_BASE + 4)
#define G_CHAR_REGISTRY       (REGISTRY_BASE + 5)

#define M_SET_XP_TOKEN            4
#define M_SET_CONSTRUCTOR_ACCOUNT 5
#define M_SET_CHAR_REGISTRY       6
```

Each setter is a one-liner in the existing creator-gated `switch` (e.g. `setMapValue(G_XP_TOKEN, ZERO, currentTx.message[1])`). No new validation beyond the existing `sender == getCreator()` gate.

`getExtMapValue` on an unset key returns `0`, so "not configured yet" is naturally distinguishable.

## Character changes (`character`)

**Remove:**
- `#define CHAR_REGISTRY`
- `long xpTokenId;` + its `#ifdef TESTBED const`
- `long constructorAccount;` + its `#ifdef TESTBED const`
- the now-empty `#ifdef TESTBED` block

**Add** internal cached state, populated once in `init()`:

```c
long xpTokenId;            // cached from registry at init
long constructorAccount;   // cached from registry at init
long charRegistry;         // cached from registry at init (was the #define)

void init() {
    xpTokenId          = getExtMapValue(G_XP_TOKEN,            ZERO, GAMEMASTER_REGISTRY);
    constructorAccount = getExtMapValue(G_CONSTRUCTOR_ACCOUNT, ZERO, GAMEMASTER_REGISTRY);
    charRegistry       = getExtMapValue(G_CHAR_REGISTRY,       ZERO, GAMEMASTER_REGISTRY);
    // ... existing init: rollAttributes, charRegistryActivationFee = getActivationOf(charRegistry), register ...
}
```

All existing uses of `CHAR_REGISTRY` become `charRegistry`. `xpTokenId` / `constructorAccount` keep their names, so their call sites (`checkLevelUp`, `receiveAssets`, `handleDead` drop, `attack` — see below) are unchanged.

The character-side keys must mirror the registry: define `GAMEMASTER_G_XP_TOKEN` / `_CONSTRUCTOR_ACCOUNT` / `_CHAR_REGISTRY` as the same `REGISTRY_BASE + n` values (same discipline as the existing `GAMEMASTER_MAP_KEY1_CONSTRUCT_HASH`).

### Caching, not live-reading

Identities are read **once at `init()`** and cached, for two reasons: (1) gas — `checkLevelUp`/`receiveAssets` touch `xpTokenId` every activation, and a cross-contract `getExtMapValue` each time is wasteful; (2) semantics — a Character's identity should be fixed for its lifetime.

**Exception:** the **construct hash stays live** (as it is today in `senderIsConstruct`), so the Gamemaster can *rotate* the trusted construct bytecode (upgrade constructs) without redeploying every Character.

### Folds in Finding 5

With `constructorAccount` now a trusted, registry-sourced value, `attack()` can validate its target:

```c
if (amount <= ZERO
    || getCreatorOf(constructId) != constructorAccount   // genuine construct = deployed by the issuer
    || amount < getActivationOf(constructId)) { /* refund, no commit, error */ }
```

The old `constructorAccount == 0` footgun is gone (it's guaranteed set from the registry, or the Character is inert — see Ordering). Optionally unify `senderIsConstruct` to the same "creator == constructorAccount" definition so "what is a construct?" has one answer — **open question** (see below), since it trades the codehash check for a creator check.

---

## Deployment ordering (load-bearing)

`init()` reads the registry at deploy time, so the registry **must be fully configured before any Character is deployed**: `G_XP_TOKEN`, `G_CONSTRUCTOR_ACCOUNT`, `G_CHAR_REGISTRY`, and `G_CONSTRUCT_HASH` all set. This constraint already exists in weaker form (the construct hash must be set, and `init()` already messages `CHAR_REGISTRY`); this makes it mandatory for `xpTokenId` too.

If the registry is not ready, a Character caches `xpTokenId = 0` and is effectively inert (`checkLevelUp` already early-returns on `xpTokenId == 0`; deposits of the "XP" token would misbehave). `init()` cannot reject its own deployment, so this is a **procedural** guarantee, not an enforceable one — document it in the deploy runbook. Consider a read-only "config healthy" view (all four globals non-zero) the dApp checks before offering deployment.

---

## Test impact

Larger than the contract change:

- **Every Character deploy now needs a configured gamemaster registry.** `deployCharacter()` (today a standalone deploy) must deploy + seed a minimal registry (`G_XP_TOKEN`, `G_CONSTRUCTOR_ACCOUNT`, `G_CHAR_REGISTRY`) before loading the Character. The `deployCharacterWith…Registry` helpers already deploy the registry — they gain a "seed globals" step.
- **Initializers go away.** `loadContract` no longer passes `{ constructorAccount, xpTokenId }`; those values are set on the registry instead. New `lib.ts` helpers: `setXpTokenOnRegistry`, `setConstructorAccountOnRegistry`, `setCharRegistryOnRegistry` (mirroring `setConstructHashOnGamemasterRegistry`).
- **`getCreatorOf` testbed caveat** (Finding 5): the simulator has a known `getCreatorOf`-reads-0 bug in multi-contract setups; the attack-target-validation test may need `test.skip` + FIXME, or verification via a construct actually created by the seeded `constructorAccount`.
- Context mirrors: add the three `G_*` keys and `M_SET_*` codes.

---

## Open questions

1. **`senderIsConstruct`: codehash or creator?** Keep the current codehash check (works in the testbed, allows construct rotation) and use *creator* only for the attack target? Or unify both on `getCreatorOf == constructorAccount` (one definition, registry-independent, but hits the testbed bug and loses cheap rotation)? Leaning: keep construct hash live for `senderIsConstruct` (rotation), use creator-check for the attack target.
2. **Inert-on-missing-config:** acceptable as a procedural guarantee, or add an explicit "is config loaded" self-check that gates player actions until healthy?
3. **Migration:** this changes the Character codehash, so it only applies to the *next* Character deployment — no in-place upgrade of already-deployed Characters. Confirm that's fine (it is, for a not-yet-released contract).

---

## Rollout

1. Registry: add `G_*` keys + `M_SET_*` setters + tests.
2. Character: remove `#define`/initializers, add cached reads in `init()`, repoint call sites, add Finding-5 target check.
3. Test infra: registry-seeding helpers; convert every deploy path.
4. Verify: full suite green; confirm compiled Character codehash is stable across test runs (no initializer-injected variance) and record it for the dApp.
