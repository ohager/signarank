# Client Library — Character Concept — Design Spec

**Date:** 2026-07-19
**Status:** Draft (approved in brainstorming; pending implementation-plan)
**Scope (two repos, one spec):**
- **Part 1 — contract:** `signarank/smartcontracts/character/character.contract.smart.c` — small public-sheet publish-schema additions.
- **Part 2 — client library:** `signarank-constructor` monorepo (transition branch) — `@signarank/services` (registry read extension) + `@signarank/client` (new `Character` class + `Player` discovery).
**Related:** `2026-07-15-construct-combat-design.md`, `2026-07-19-status-effects-design.md`, `2026-05-06-gamemaster-registry-design.md`, `2026-07-12-registry-as-config-design.md`.

---

## Goal

The `@signarank/client` library (v0.0.4) models a player as an **EOA account** (`ReadOnlyPlayer`/`Player`) that reads balances/XP and attacks constructs directly. It has **no notion of a Character** — the player-owned smart-contract actor introduced by the character/registry work. This spec introduces the Character concept end-to-end so the (out-of-scope) character page in the signarank app can display a character sheet and drive owner actions through the library.

A Character is its own AT contract, owned by one EOA, with attributes / level / skill points / HP / inventory / a published combat profile / timed status effects, discoverable via the character-account registry, configured against the gamemaster registry (items/effects), and driven **only** by its owner's messages plus inbound construct messages. There is no gamemaster write side for characters.

## Non-goals (out of scope)

- The **character-page UI** in the signarank app (this spec delivers the contract schema + the library that powers it).
- **Gamemaster admin** write helpers for characters (none exist — characters have a single writer, the owner).
- Real **poison/stun mechanics** (HP-drain-over-time, skip-action). Today "status effects" are timed *stat modifiers*; DoT/stun would be a later contract pass.
- **Construct read modernization** (see Follow-up tickets).
- Resolving the **level-threshold inconsistency** (see Follow-up tickets).

---

## Current state (what exists)

Monorepo package layout (`signarank-constructor`):

- **`@signarank/common`** — `Signer` interface, `tryCall`, `withError`.
- **`@signarank/services`** — ledger-facing services:
  - `construct/` — `ConstructReadService` (discovery via `getAllContractsByCodeHash` / `getContractsByAccount`, `.with(id)`), `ConstructInstanceReadService` (reads state via `ContractDataView` **offsets** — `DataFieldIndex`), plus admin/instance-admin (gamemaster).
  - `gamemaster-registry/` — `GamemasterRegistryReadService` (`getItem`, `getEffect`, `getConstructHash`, `getCharacterHash`, `getLevelThresholds`, `getErrors`) + admin service + `gamemaster-registry.constants.ts` (mirrors on-chain `#define`s; contains `EffectMode`/`EffectTarget`/`ItemType`/`ItemKey`/`EffectKey` enums).
  - `system/`, `crypto/`, `media/`.
- **`@signarank/client`** — thin player-facing facade: `ReadOnlyPlayer` (balances, XP, `constructService` getter), `Player extends ReadOnlyPlayer` (`attackConstruct` — builds an unsigned tx, calls `Signer.sign`, returns the result), `storage` (`IStorage`/`MemoryStorage`/`LocalStorage`). Re-exports the construct read services.

The signarank Next app consumes `@signarank/client` from **npm** (`"@signarank/client": "^0.0.4"`).

### Known drift (informs scope)

- `gamemaster-registry.constants.ts` `Globals` only defines `ConstructHash (+1)`, `CharacterHash (+2)`, `LevelThreshold (+10)`, `ErrorLog (+99)`. It is **missing** `G_XP_TOKEN (+3)`, `G_CONSTRUCTOR_ACCOUNT (+4)`, `G_CHAR_REGISTRY (+5)`, `G_NEXT_CHARACTER_HASH (+6)` that the finalized contract defines.
- `ConstructInstanceReadService` reads memory via `ContractDataView` offsets that are **stale** (still lists `EventListenerAccountId`, lacks the new drop/counter/attacker fields) and whose offsets **shift** under the construct's new `#pragma maxConstVars 7`. Latent until a new construct is deployed. → Follow-up ticket.

---

## Part 1 — Character contract publish-schema changes (TDD)

All additive; each behind a failing test first. The character **codehash changes again** as a result (see Deployment).

### 1.1 New `MAP_KEY1_VITALS` (scalar sheet)

A published, cross-contract-readable "live combat state" sheet, written at the end of every activation from within `publishProgression()` (which already runs each activation), alongside `publishCombatProfile()`.

- Proposed key1: `16` (final value chosen at implementation; must not collide with 1–14, 20–22).
- k2 sub-ids: `1 = currentHitpoints`, `2 = maxHitpoints`, `3 = isDead` (0/1).

Rationale: `currentHitpoints` is live state that cannot be derived off-chain; `maxHitpoints` is derivable (`100 + STA*10`) but published so the map is self-contained for other contracts; `isDead` is memory-only. Robust against recompiles/pragma changes (unlike memory-offset reads).

### 1.2 Extend `MAP_KEY1_COMBAT` with the remaining effective stats

`MAP_KEY1_COMBAT` (key1 `4`) currently publishes effective `strength (1)`, `luck (2)`, `attackAbs (3)`, `attackRel (4)`, `attackEffect (5)`. Add effective:

- `6 = effective stamina`, `7 = effective dexterity`, `8 = effective willpower`.

"Effective" = base attribute + equipment aggregate + active status contribution, matching how strength/luck are already computed in `publishCombatProfile()`. **Backward-compatible**: the construct reads only k2 1–5 and is unaffected. This makes `COMBAT` a complete effective-stats sheet so the UI can show per-stat deltas (base vs effective) without re-deriving.

### 1.3 New `MAP_KEY1_STATUS_EFFECT_ID` (status identity)

Status effects are a public **collection** keyed by target (`STATUS_EFFECTS` 12 = expiry, `STATUS_ABS` 13, `STATUS_REL` 14). `storeStatus()` currently discards the source `effectId`, so a reader can only show a *generic* label ("Strength −2 for 12 blocks"). Add a parallel map so identity is resolvable:

- Proposed key1: `15` (contiguous with the status collection).
- Layout: `map[target] = effectId`, written in `storeStatus()` (one extra `setMapValue`).

The client resolves `effectId → name/icon` via the gamemaster effect catalog (`GamemasterRegistryReadService.getEffect`). Registry effects have no human name field today; near-term the client derives a themed label from `(target, sign, mode)` and/or the source item, with the stored `effectId` enabling richer resolution later.

### 1.4 Explicitly NOT published (stays internal, memory-index read)

`rerollCount`, `committed`, `migrated` remain contract-memory variables. The client reads them via `ContractDataView` memory index (a `DataFieldIndex` for the character).

- **Caveat (documented in the client):** these offsets depend on `maxAuxVars` (3) + `maxConstVars` (10) + declaration order, so the character `DataFieldIndex` **must be regenerated whenever the character contract is recompiled**. Acceptable for these low-stakes internal values (rerolls-left, committed flag, retired flag).

### 1.5 Budget & tests

- Re-verify code size ≤ 10240 after the additions (headroom is ample post-`maxConstVars 10`: ~1700 B free).
- TDD: a test per new/extended map (VITALS fields present + fresh after HP change; COMBAT sta/dex/will effective values incl. equip+status; STATUS_EFFECT_ID stored on apply and consumed by identity resolution). Keep the full character suite green.

---

## Part 2 — Client library

### 2.1 `@signarank/services` — extend `GamemasterRegistryReadService`

Add reads for the globals the client needs and reconcile constants:

- `getXpToken()` → `G_XP_TOKEN (+3)`
- `getConstructorAccount()` → `G_CONSTRUCTOR_ACCOUNT (+4)`
- `getCharRegistry()` → `G_CHAR_REGISTRY (+5)`
- `getNextCharacterHash()` → `G_NEXT_CHARACTER_HASH (+6)`
- `isMigrationWindowOpen()` → `getNextCharacterHash() !== "0"`
- (`getCharacterHash()` already exists.)

Reconcile `Globals` in `gamemaster-registry.constants.ts` to include `+3..+6`. **Leave `LevelThreshold` untouched** (`apps/control-center` consumes it). Add a `character.constants.ts` under a new `character/` service dir (see below) mirroring the character contract's map keys / enums.

The gamemaster registry is the **single source of truth**: the client sources `charRegistry` and `xpToken` from it rather than requiring the app to configure each.

### 2.2 `@signarank/services` — new `character/` service dir

Mirror the `construct/` layout, but **no read/write-instance split** (a character has one writer + inbound construct messages; there is no admin side):

- `character.constants.ts` — mirror the character contract's public map keys (ATTRIBUTES, INVENTORY, PROGRESSION, COMBAT, EQUIP_BONUS_ABS/REL, STATUS_EFFECTS/ABS/REL/EFFECT_ID, VITALS, ERROR_*), method codes, and the effect target/mode enums (or re-use the registry ones).
- `character.service.context.ts` — `{ ledger, gamemasterRegistryId }` (charRegistry + xpToken derived from the registry), plus a `StandardLedger` + `Signer` variant for writes.

Note: the **read logic** for a single character lives in the `Character` class in `@signarank/client` (§2.3), not in a separate `CharacterInstanceReadService`. The `character/` service dir holds the shared constants/context/discovery helpers only. (This honors "no dedicated read/write instance service.")

### 2.3 `@signarank/client` — the `Character` class

One class handles **read and optional write**. Writes are enabled by the presence of an injected `Signer`; reads only need a `ReadOnlyLedger`.

```ts
type CharacterContext = {
  ledger: ReadOnlyLedger | StandardLedger;
  characterId: string;
  gamemasterRegistryId: string;
  signer?: Signer;                 // present ⇒ writes enabled
  cache?: IStorage<unknown>;       // catalog/token cache
};

class Character {
  constructor(ctx: CharacterContext);

  // ---- reads (ReadOnlyLedger sufficient) ----
  getSheet(): Promise<CharacterSheet>;      // one composed view (see below)
  getAttributes(): Promise<Attributes>;      // base STR/STA/DEX/LUCK/WILL
  getCombatProfile(): Promise<CombatProfile>;// effective stats + attack abs/rel/effect
  getProgression(): Promise<Progression>;    // level, skillPoints
  getVitals(): Promise<Vitals>;              // currentHp, maxHp, isDead
  getInventory(): Promise<InventoryItem[]>;  // slots resolved to item metadata (grouped to stacks)
  getConditions(): Promise<Condition[]>;     // active timed status effects (see below)
  getErrorLog(): Promise<CharacterError[]>;  // rolling ring buffer
  getInternalState(): Promise<InternalState>;// rerollCount, committed, migrated (memory-index)

  // ---- writes (require signer; sign & broadcast → tx id) ----
  allocateSkillPoint(attribute: AttributeId): Promise<TransactionId>;
  attack(params: { constructId: string; force: Amount; elementToken?: { assetId: string; quantity: ChainValue } }): Promise<TransactionId>;
  reroll(): Promise<TransactionId>;
  useItem(tokenId: string): Promise<TransactionId>;
  transferItem(tokenId: string, recipientId: string): Promise<TransactionId>;
  seppuku(): Promise<TransactionId>;
  migrate(): Promise<TransactionId>;
  refund(): Promise<TransactionId>;
}
```

**Conditions (`getConditions`)** are computed client-side: read `STATUS_EFFECTS/ABS/REL/EFFECT_ID` + current block height, keep entries with `expiry > now`, and resolve each via `getEffect(effectId)` from the catalog to a `{ target, effectId, name?, abs, rel, expiryBlock, blocksRemaining, kind }` where `kind` is a themed label derived from `(target, sign, mode)` (e.g. Weakened/Strengthened, Vulnerable/Warded).

**Reads are uncached** (live sheet); **catalog/token lookups are cached** (see §2.5).

Write methods all follow the `attackConstruct` pattern: build the unsigned tx (message array `[method, arg1, arg2, arg3]` + amounts/assets), call `Signer.sign(...)`, return the transaction id. Throw early if `signer` is absent or input is invalid.

### 2.4 Discovery — folded into `Player`

A Character is *owned by* an EOA, reached through the player. No standalone discovery service.

```ts
// ReadOnlyPlayer
getCharacters(): Promise<{ characterId: string; version: string }[]>;  // via char registry
character(characterId: string): Character;                             // read-only (no signer)

// Player (adds the signer)
character(characterId: string): Character;                             // write-enabled
```

`getCharacters()` reads the char-account registry: resolve `charRegistry` from the gamemaster registry, then `getContractMapValuesByFirstKey(charRegistry, ownerAccountId)` → filter out the reserved `(creator, 0)` counter slot and any zeroed (unregistered) entries → `[{ characterId, version=codehash }]`. This reflects **live, non-migrated** characters (seppuku/migrate unregister; combat-dead stays listed so it can be revived). Cap: 5 per account.

Viewing another player's characters: `new ReadOnlyPlayer({ ledger, accountId: otherEOA }).getCharacters()` — same path, no signer.

### 2.5 Amounts & validation (client-owned)

The client computes and validates all amounts (no caller-supplied planck):

- **`attack`** — read the construct's and the character's `minActivation`; ensure `force` covers the required minimum; attach `force` (+ the single optional element asset). Document the forward-through-character mechanics (character forwards the incoming amount to the construct) and character gas headroom during implementation, verified against the contract + testbed.
- **`reroll`** — attach `REROLL_COSTS` (100 SIGNA) + activation unless the character is already funded ≥ costs.
- All other writes — attach the character's activation fee.
- Standard interaction fee (matching `attackConstruct`'s `0.02` SIGNA convention).

Invalid input (unknown attribute, `force` below minimums, transfer to a contract recipient, etc.) throws before signing.

### 2.6 Caching

- **Catalog + token data cached** (`IStorage`): gamemaster item/effect definitions and token `Asset` info are effectively immutable during a session. **Default TTL ~10 minutes**, chosen to sit just past the ~2-block (~8 min) settle for a catalog edit; overridable by the app.
- **Live character sheet uncached** — read from chain each time (always fresh); nothing to invalidate after a write. Optional short TTL for polling throttling, **off by default**.

### 2.7 Release

- Minor bump `@signarank/client` and `@signarank/services` → **`0.1.0`** via a Changeset describing the character API.
- `@signarank/common` unchanged (no bump; `Signer` reused).
- Closing step: bump the signarank Next app dependency to `"@signarank/client": "^0.1.0"`.

---

## Deployment notes

- The character codehash changes (Part 1). At deploy, update **`G_CHARACTER_HASH`** on the gamemaster registry and the **trusted character hash** on the char-account registry to the new value. Pre-launch, no live characters depend on the old layout.
  - New character codehash after the publish-schema additions (VITALS + effective sta/dex/will in COMBAT + STATUS_EFFECT_ID) **and the DEDUCT_HITPOINTS/COMBAT → unified RECEIVE_ATTACK(13) consolidation**: **`1535226251089564205`** (code size 9058/10240 bytes). This is the value to set as `G_CHARACTER_HASH` and the char-account-registry trusted character hash. Also feeds `CharacterDataFieldIndex` derivation in Part 2 Task 10. (Supersedes the earlier `8336535780851164957`, which predated the RECEIVE_ATTACK consolidation.)
- Work happens on the `signarank-constructor` **transition branch**; `main` (old code, tagged) is untouched until the transition is complete, so the latent construct-reader break is an acceptable mid-transition state.

## Testing approach (TDD)

- **Part 1 (contract):** RED→GREEN per new/extended map, using the existing character testbed (`signarank/smartcontracts`); keep the full character suite green; re-verify size ≤ 10240.
- **Part 2 (library):** unit-test the registry read extensions and the `Character` reads (composed sheet, conditions resolution, inventory grouping, memory-index internal state) against the existing testbed/simulator fixtures; test write methods build the correct message array + amounts and validate/throw on bad input (mock `Signer`). Follow the existing `construct.instance.read.service.test.ts` conventions.

## Follow-up tickets (documented, not built here)

1. **Construct read modernization.** `ConstructInstanceReadService` is stale (removed `eventListenerAccountId`, missing new fields) and its `ContractDataView` offsets shift under `maxConstVars 7`. Fix when the new construct is deployed, preferably by having the construct **publish a status map** (mirroring character `VITALS`) to escape offset fragility for good.
2. **Level-threshold inconsistency.** The gamemaster can set registry level thresholds (`apps/control-center`) that the character contract never reads (it uses its own triangular `LEVEL_XP_BASE` curve). Resolve in the gamemaster domain (either drive the character from registry thresholds or retire the registry feature).

## Decision log

- **D1** Add published `MAP_KEY1_VITALS` (currentHp, maxHp, isDead), written in `publishProgression()`. Future-proof for cross-contract reads.
- **D2** `rerollCount`/`committed`/`migrated` stay internal (memory-index read; `DataFieldIndex` regenerated per recompile).
- **D3** Extend `MAP_KEY1_COMBAT` with effective stamina/dex/willpower (k2 6/7/8); backward-compatible with construct reads.
- **D4** Status stays a public collection; add `MAP_KEY1_STATUS_EFFECT_ID` (target → effectId) in `storeStatus()`; client computes active conditions and resolves identity via the gamemaster effect catalog.
- **D5** Real poison/stun *mechanics* are a later contract pass — out of scope.
- **D6** Discovery via the char-account registry index (`getContractMapValuesByFirstKey(charRegistry, owner)`, filtered) → `[{characterId, version}]`.
- **D7** Single `Character` class in `@signarank/client` (read + optional write via signer presence); charRegistry + xpToken derived from the gamemaster registry.
- **D8** Discovery folded into `Player` (`getCharacters()`, `character(id)`); no standalone service.
- **D9** All `Character` writes sign & broadcast via the injected `Signer` → transaction id; full owner-action set (incl. seppuku/migrate).
- **D10** Extend `GamemasterRegistryReadService` with the `+3..+6` globals + `isMigrationWindowOpen()`; reconcile constants; leave `LevelThreshold`.
- **D11** Construct reader realignment = documented follow-up ticket (not built here).
- **D12** Client owns amount computation & validation.
- **D13** Cache catalog/token data (default ~10 min TTL, overridable); live sheet uncached (optional short TTL off by default).
- **D14** Minor bump to `0.1.0` (client + services) via Changeset; app dep bump `^0.1.0` as the closing step; character-page UI out of scope.
- **D15** Spec home: `signarank/docs/superpowers/specs/2026-07-19-client-character-design.md`.
