# Gamemaster Registry — Design Spec

**Date:** 2026-05-06
**Status:** Approved
**Scope:** Smart contracts only (extends `2026-05-03-character-contract-design.md`)
**Supersedes:** The "Item Registry Contract" section of the Character Contract spec.

---

## Motivation

The Character Contract is owned solely by the Player (`getCreator()`). It must not be controllable by any central authority. Yet several values used by the Character — Construct code hash, Character code hash, level threshold table, item definitions — are game rules controlled by the Gamemaster and shared across all Players.

These values therefore live on a **single global Gamemaster Registry contract**, deployed once by the Gamemaster, before any Character is deployed. The Character contract embeds the Registry's account ID as a compile-time constant.

This document replaces the original `item-registry.contract.smart.c` with a generic Gamemaster Registry that holds:

- Global Gamemaster settings (construct/character hashes, level thresholds)
- Item definitions (intrinsic per-token properties + references to effects)
- Effect definitions (the actual gameplay impact, reusable across items)

---

## Architecture

```
Gamemaster Wallet
   │
   ├── deploys (once, before any Character)
   ▼
Gamemaster Registry (singleton)
   │
   │  reads via getExtMapValue(...)
   │
   ├──────────────────────────┬──────────────────────────┐
   ▼                          ▼                          ▼
Character Contract       Construct Contract         Off-Chain Frontend
(per Player)             (per Season)               (Item inspection,
                                                     catalog UI)
```

**Deployment order:** Registry → (Constructs) → Characters. The Registry's account ID becomes a `#define SRANK_REGISTRY <account_id>` in both Character and Construct sources.

---

## Key Namespace

The Registry uses a single KKV map. Globals and Effects live in a small reserved
window at the **high end** of the int64 key1 range; Items use everything else,
including all negative int64 values (= uint64 token IDs whose bit 63 is set).

```
#define REGISTRY_BASE  0x7FFFFFFFFFF00000   // (MAX_LONG - 0xFFFFF)
```

| Key1 Range                                              | Domain             | Key2 Meaning        |
|---------------------------------------------------------|--------------------|---------------------|
| `REGISTRY_BASE + 1 .. REGISTRY_BASE + 99`               | Global Settings    | sub-id              |
| `REGISTRY_BASE + 100 .. REGISTRY_BASE + 999_999`        | Effect Definitions | effect property id  |
| anything `< REGISTRY_BASE` and `!= 0` (incl. negatives) | Item Definitions   | item property id    |

The Registry rejects `tokenId == 0` (no such Signum asset) and any `tokenId >= REGISTRY_BASE`
in every item-touching entry point.

**Why this layout:** the off-chain Signum Node API supports listing all `(k2, value)`
pairs for a given `k1` in one request. With `k1 = tokenId`, the frontend fetches all
properties of one item in a single API call — efficient for item-card rendering.

**Why high-end packing:** Signum asset IDs span the full uint64 range. SmartC's `long`
is signed, so any token ID with bit 63 set appears as a negative long inside the
contract. Reserving the high end of the signed range (~10^6 keys out of 2^64) lets us
validate tokenIds with a single `tokenId >= REGISTRY_BASE` compare that works correctly
for negative longs too. The collision probability for a randomly-assigned asset ID is
~5×10^-14.

**Off-chain encoding:** all callers (Gamemaster tools, frontend, sibling contracts)
must add `REGISTRY_BASE` to logical IDs before sending them to the Registry and
before reading via `getMapValue`. The test helper `effectK1(n)` in `lib.ts` is the
canonical implementation.

---

## Global Settings

Each global concept gets its own `key1`. Tabular values use `key2` as the row index.
All k1 values shown below are offsets relative to `REGISTRY_BASE`.

| K1 (offset from REGISTRY_BASE) | K2       | Value                  |
|--------------------------------|----------|------------------------|
| `+1`                           | 0        | Construct Code Hash    |
| `+2`                           | 0        | Character Code Hash    |
| `+10`                          | `level`  | XP threshold for level |

Off-chain consumers can fetch the entire level threshold table via
`listByFirstKey(k1 = REGISTRY_BASE + 10)`.

---

## Item Definition (`key1 = tokenId`, where `0 < tokenId < REGISTRY_BASE` OR `tokenId` is negative)

| K2     | Property      | Notes                              |
|--------|---------------|------------------------------------|
| 1      | Item Type     | 1 = Equipment, 2 = Consumable      |
| 2      | Stack Limit   | max instances of this token        |
| 3      | Min Level     | minimum Character level to hold    |
| 4      | Effect Count  | number of effect slots populated   |
| 10 + i | Effect ID `i` | reference to an effect definition  |

**Item Type** governs **token lifecycle** only:
- `Equipment` — token persists in Character inventory; effects applied on equip, removed on unequip.
- `Consumable` — token burned on use; effects applied once (permanent for `AGGREGATE_*`, transient for `HEAL`/`REVIVE`/`STATUS_EFFECT`).

Item Type does **not** govern effect application — that's the Effect's `Mode`.

**Effect Count semantics:** number of populated slots, beginning at slot 0. Gaps are tolerated by the Character (zero-effectId slots are skipped) but the Gamemaster keeps things contiguous.

**One token = one inventory slot** (per unit). Stack of 5 healing potions occupies 5 slots.

---

## Effect Definition (`key1 = REGISTRY_BASE + effectId`, effectId in `100..999_999`)

| K2 | Property     | Notes                                     |
|----|--------------|-------------------------------------------|
| 1  | Target       | what attribute / aggregate this affects   |
| 2  | Bonus Abs    | absolute value (e.g. +50 HP, +2 STR)      |
| 3  | Bonus Rel    | relative value (percent or percent-point) |
| 4  | Mode         | how the effect is applied (see below)     |
| 5  | Duration     | in blocks; `0` = permanent                |

### Effect Target enum (open-ended)

The Character treats `target` as an **opaque numeric key** for storing aggregated bonuses (Modes 1–2) or as a status type id (Mode 5). New target values can be added without recompiling the Character contract.

Initial assignments:

| Target | Meaning            |
|--------|--------------------|
| 0      | Attack damage      |
| 1      | HP / Max HP        |
| 2      | Strength           |
| 3      | Stamina            |
| 4      | Dexterity          |
| 5      | Luck               |
| 6      | Willpower          |
| 7      | Inventory Slots    |
| 8      | Damage Taken       |
| 9..    | reserved for future|

### Effect Mode enum (closed set)

The Character has a hardcoded dispatcher for these modes. Adding a new mode requires a Character update; adding a new target does not.

| Mode | Name             | Behaviour                                                           |
|------|------------------|---------------------------------------------------------------------|
| 1    | `AGGREGATE_ABS`  | `EQUIP_BONUS_ABS[target] += sign * bonusAbs`                       |
| 2    | `AGGREGATE_REL`  | `EQUIP_BONUS_REL[target] += sign * bonusRel`                       |
| 3    | `HEAL`           | `currentHP = min(currentHP + bonusAbs, maxHP)` (only if alive)     |
| 4    | `REVIVE`         | `isDead = false; currentHP = maxHP * bonusAbs / 100` (only if dead)|
| 5    | `STATUS_EFFECT`  | write `STATUS[target] = currentBlock + duration`                    |

`sign` is `+1` on equip, `-1` on unequip (only meaningful for `AGGREGATE_*` modes on Equipment items).

Unknown modes are silently ignored by the Character → forward-compatible: future contracts can register effects with new modes that older Characters simply skip.

---

## Registry Methods

All methods gated by `currentTx.sender == getCreator()` (Gamemaster wallet).

| Code | Name                  | Message Layout                                                          |
|------|-----------------------|-------------------------------------------------------------------------|
| 1    | `SET_CONSTRUCT_HASH`  | `m[1] = hash`                                                           |
| 2    | `SET_CHARACTER_HASH`  | `m[1] = hash`                                                           |
| 3    | `SET_LEVEL_THRESHOLD` | `m[1] = level`, `m[2] = xpRequired`                                     |
| 10   | `REGISTER_ITEM`       | `m[1] = tokenId`, `m[2] = packed(type, stackLimit, minLevel)`, `m[3] = effectCount` |
| 11   | `UNREGISTER_ITEM`     | `m[1] = tokenId` — clears all `(tokenId, *)`                            |
| 12   | `SET_ITEM_EFFECT`     | `m[1] = tokenId`, `m[2] = slot`, `m[3] = effectId`; bumps EffectCount if `slot >= count` |
| 20   | `REGISTER_EFFECT`     | `m[1] = effectId`, `m[2] = packed(target, mode)`, `m[3] = packed(bonusAbs, bonusRel, duration)` |
| 21   | `UNREGISTER_EFFECT`   | `m[1] = effectId` — clears all `(effectId, *)`                          |

**Validation:**
- `REGISTER_ITEM`: rejects `tokenId == 0` or `tokenId >= REGISTRY_BASE`, `effectCount > MAX_EFFECT_SLOTS_PER_ITEM` (cap 8), invalid item type
- `REGISTER_EFFECT`: rejects `effectId < MIN_EFFECT_ID` or `effectId > MAX_EFFECT_ID`, invalid mode
- `SET_ITEM_EFFECT`: rejects bad tokenId, `slot < 0`, `slot >= MAX_EFFECT_SLOTS_PER_ITEM`
- `UNREGISTER_ITEM` / `UNREGISTER_EFFECT`: rejects out-of-range keys (same gates as their `REGISTER_*` counterparts)

**Error log:** every rejected creator tx writes `(G_ERROR_LOG, txId) = errorCode`
to the KKV map, where `G_ERROR_LOG = REGISTRY_BASE + 99`. This lets the Gamemaster
diagnose silent failures without re-running the tx. Non-creator txs are dropped
before dispatch and do not produce an entry.

| Code | Name                       | Trigger                                                            |
|------|----------------------------|--------------------------------------------------------------------|
| 1    | `ERR_TOKEN_ID_INVALID`     | tokenId == 0 or in `[REGISTRY_BASE, MAX_LONG]`                     |
| 2    | `ERR_EFFECT_ID_INVALID`    | effectId outside `[MIN_EFFECT_ID, MAX_EFFECT_ID]`                  |
| 3    | `ERR_INVALID_ITEM_TYPE`    | item type not in {1: Equipment, 2: Consumable}                     |
| 4    | `ERR_INVALID_MODE`         | effect mode outside `[MIN_MODE, MAX_MODE]`                         |
| 5    | `ERR_INVALID_SLOT`         | effect slot outside `[0, MAX_EFFECT_SLOTS_PER_ITEM)`               |
| 6    | `ERR_EFFECT_COUNT_INVALID` | item effectCount > MAX_EFFECT_SLOTS_PER_ITEM                       |

---

## Character Contract Changes

### New generic bonus storage (replaces named `equip*Bonus` variables)

```c
#define MAP_KEY1_EQUIP_BONUS_ABS 10  // key2 = target → cumulative abs bonus
#define MAP_KEY1_EQUIP_BONUS_REL 11  // key2 = target → cumulative rel bonus
#define MAP_KEY1_STATUS_EFFECTS  12  // key2 = status target → expiry block
```

### Updated registry-key constants

The current Character file uses obsolete keys (`SRANK_MAP_KEY1_CONSTRUCT_HASH = 2`, etc.). Replace with the new layout:

```c
#define SRANK_REGISTRY            <baked-in account id>

// Globals (k1 = setting-id, k2 = sub-id)
#define SRANK_KEY_CONSTRUCT_HASH  1
#define SRANK_KEY_CHARACTER_HASH  2
#define SRANK_KEY_LEVEL_THRESHOLD 10

// Item properties (k1 = tokenId, k2 = property)
#define SRANK_ITEM_KEY_TYPE         1
#define SRANK_ITEM_KEY_STACK_LIMIT  2
#define SRANK_ITEM_KEY_MIN_LEVEL    3
#define SRANK_ITEM_KEY_EFFECT_COUNT 4
#define SRANK_ITEM_KEY_EFFECT_BASE  10

// Effect properties (k1 = effectId, k2 = property)
#define SRANK_EFFECT_KEY_TARGET     1
#define SRANK_EFFECT_KEY_BONUS_ABS  2
#define SRANK_EFFECT_KEY_BONUS_REL  3
#define SRANK_EFFECT_KEY_MODE       4
#define SRANK_EFFECT_KEY_DURATION   5
```

### Construct detection (existing pattern, updated keys)

```c
long senderIsConstruct() {
    long codehash = getExtMapValue(SRANK_KEY_CONSTRUCT_HASH, 0, SRANK_REGISTRY);
    return getCodeHashOf(currentTx.sender) == codehash;
}
```

### Equip / Use Item flow

```c
case EQUIP_ITEM:
    long tokenId  = currentTx.message[1];
    if (getQuantity(currentTx.txId, tokenId) < 1) { return; }

    long itemType = getExtMapValue(tokenId, SRANK_ITEM_KEY_TYPE, SRANK_REGISTRY);
    long minLevel = getExtMapValue(tokenId, SRANK_ITEM_KEY_MIN_LEVEL, SRANK_REGISTRY);
    if (level < minLevel) { refund; return; }

    long stackLimit = getExtMapValue(tokenId, SRANK_ITEM_KEY_STACK_LIMIT, SRANK_REGISTRY);
    if (getAssetBalance(tokenId) > stackLimit) { refund; return; }

    long incoming = getQuantity(currentTx.txId, tokenId);
    if (usedInventorySlots + incoming > maxInventorySlots) { refund; return; }
    usedInventorySlots += incoming;

    applyAllEffects(tokenId, +1);

    if (itemType == ITEM_TYPE_CONSUMABLE) {
        sendQuantity(incoming, tokenId, ZERO);  // burn
        usedInventorySlots -= incoming;
    }
    break;
```

### Generic effect application

```c
void applyAllEffects(long tokenId, long sign) {
    long effectCount = getExtMapValue(tokenId, SRANK_ITEM_KEY_EFFECT_COUNT, SRANK_REGISTRY);
    long slot;
    for (slot = 0; slot < effectCount; slot++) {
        long effectId = getExtMapValue(tokenId, SRANK_ITEM_KEY_EFFECT_BASE + slot, SRANK_REGISTRY);
        if (effectId != 0) { applyEffect(effectId, sign); }
    }
}

void applyEffect(long effectId, long sign) {
    long target   = getExtMapValue(effectId, SRANK_EFFECT_KEY_TARGET,    SRANK_REGISTRY);
    long bonusA   = getExtMapValue(effectId, SRANK_EFFECT_KEY_BONUS_ABS, SRANK_REGISTRY);
    long bonusR   = getExtMapValue(effectId, SRANK_EFFECT_KEY_BONUS_REL, SRANK_REGISTRY);
    long mode     = getExtMapValue(effectId, SRANK_EFFECT_KEY_MODE,      SRANK_REGISTRY);
    long duration = getExtMapValue(effectId, SRANK_EFFECT_KEY_DURATION,  SRANK_REGISTRY);

    if (mode == MODE_AGGREGATE_ABS) {
        long current = getMapValue(MAP_KEY1_EQUIP_BONUS_ABS, target);
        setMapValue(MAP_KEY1_EQUIP_BONUS_ABS, target, current + sign * bonusA);
    }
    else if (mode == MODE_AGGREGATE_REL) {
        long current = getMapValue(MAP_KEY1_EQUIP_BONUS_REL, target);
        setMapValue(MAP_KEY1_EQUIP_BONUS_REL, target, current + sign * bonusR);
    }
    else if (mode == MODE_HEAL) {
        if (isDead == TRUE) { return; }
        currentHitpoints += bonusA;
        if (currentHitpoints > maxHitpoints) { currentHitpoints = maxHitpoints; }
    }
    else if (mode == MODE_REVIVE) {
        if (isDead != TRUE) { return; }
        isDead = FALSE;
        long pct = bonusA;
        if (pct > 100) { pct = 100; }
        currentHitpoints = (maxHitpoints * pct) / 100;
        if (currentHitpoints == ZERO) { currentHitpoints = 1; }
    }
    else if (mode == MODE_STATUS_EFFECT) {
        setMapValue(MAP_KEY1_STATUS_EFFECTS, target, getCurrentBlockheight() + duration);
    }
    // unknown mode → silently ignored (forward compatible)
}
```

### Removed: auto-revive in `handleDead()`

The current `handleDead()` self-revives the Character with a random skill-point penalty. **This is removed.** Death is sticky until an item with `MODE_REVIVE` is consumed. Skill-point penalty on death stays (it's a death-time event, not a revive-time event).

```c
void handleDead() {
    // Random skill point penalty (existing logic, simplified)
    long i;
    long rnd;
    long attrValue;
    for (i = 0; i < 10; ++i) {
        rnd = ((getWeakRandomNumber() >> 1) % FIVE) + 1;
        attrValue = getMapValue(MAP_KEY1_ATTRIBUTES, rnd);
        if (attrValue > ZERO) {
            setMapValue(MAP_KEY1_ATTRIBUTES, rnd, attrValue - 1);
            break;
        }
    }
    // No HP restore. No isDead reset. Player must use a REVIVE item.
}
```

### Construct-side reads (unchanged pattern)

The Construct reads aggregated bonuses by target key:
```c
long strBonus = getExtMapValue(MAP_KEY1_EQUIP_BONUS_ABS, TARGET_STR, charAddr);
long dexBonus = getExtMapValue(MAP_KEY1_EQUIP_BONUS_ABS, TARGET_DEX, charAddr);
long dmgRedPct = getExtMapValue(MAP_KEY1_EQUIP_BONUS_REL, TARGET_DAMAGE_TAKEN, charAddr);
```

---

## Worked Example: "Leharis' Ring der Überheblichkeit"

A unique Equipment ring giving +2 STR, +1 DEX, and −10% damage taken.

**One-time effect registration (Gamemaster):**
```
REGISTER_EFFECT(effectId=1001, target=2(STR), mode=AGGREGATE_ABS, bonusAbs=2)
REGISTER_EFFECT(effectId=1002, target=4(DEX), mode=AGGREGATE_ABS, bonusAbs=1)
REGISTER_EFFECT(effectId=1003, target=8(DAMAGE_TAKEN), mode=AGGREGATE_REL, bonusRel=10)
```

**Item registration (Gamemaster):**
```
REGISTER_ITEM(tokenId=Leharis, type=Equipment, stackLimit=1, minLevel=5, effectCount=3)
SET_ITEM_EFFECT(tokenId=Leharis, slot=0, effectId=1001)
SET_ITEM_EFFECT(tokenId=Leharis, slot=1, effectId=1002)
SET_ITEM_EFFECT(tokenId=Leharis, slot=2, effectId=1003)
```

**Player equips the ring:**
```
OwnerWallet ──TX(asset=Leharis, qty=1, msg=[EQUIP_ITEM, Leharis])──▶ Character
```

Character runs `applyAllEffects(Leharis, +1)`:
- `EQUIP_BONUS_ABS[STR] += 2`
- `EQUIP_BONUS_ABS[DEX] += 1`
- `EQUIP_BONUS_REL[DAMAGE_TAKEN] += 10`

**Player unequips (sends back to wallet via `TRANSFER_ITEM` — out of scope here):**
Character runs `applyAllEffects(Leharis, -1)` to undo.

---

## Migration

The existing `item-registry/` folder is renamed and refactored. No on-chain migration is needed (registry not yet deployed to mainnet).

**File moves / renames:**
- `smartcontracts/item-registry/` → `smartcontracts/gamemaster-registry/`
- `item-registry.contract.smart.c` → `gamemaster-registry.contract.smart.c`
- `#program name ItemReg` → `#program name SrankReg`
- `register-item.test.ts` stays in the new folder; tests rewritten for the new key layout (k1=tokenId)

**Character contract updates:**
- Remove `SRANK_MAP_KEY1_ITEMS`, `SRANK_MAP_KEY1_CONSTRUCT_HASH`, `SRANK_MAP_KEY2_CHARACTER_HASH` (obsolete numbering)
- Add the new `SRANK_KEY_*` constants per the layout above
- Replace named equipment-bonus state variables (none currently exist post-WIP, but the new generic KKV maps need to be added)
- Remove auto-revive from `handleDead()`; add `EQUIP_ITEM` / `USE_ITEM` handler

---

## Testing Strategy

### Registry unit tests (in `gamemaster-registry/`)

1. **Globals**
   - `SET_CONSTRUCT_HASH` — reads back via `getMapValue(1, 0)`
   - `SET_CHARACTER_HASH` — reads back via `getMapValue(2, 0)`
   - `SET_LEVEL_THRESHOLD` — multiple levels, listByFirstKey check
   - Non-creator cannot set globals

2. **Effects**
   - `REGISTER_EFFECT` for each mode — all properties stored correctly
   - `UNREGISTER_EFFECT` clears all `(effectId, *)`
   - Reject `effectId == 0`, `effectId > MAX_EFFECT_ID`, invalid mode
   - Non-creator cannot register effects

3. **Items**
   - `REGISTER_ITEM` for equipment + consumable — properties stored correctly
   - `SET_ITEM_EFFECT` populates slot, bumps `EffectCount` only when `slot >= count`
   - `UNREGISTER_ITEM` clears all `(tokenId, *)` including effect slots
   - Reject `tokenId == 0`, invalid item type, slot exceeding cap
   - Non-creator cannot register items

### Character integration tests (against a mock/real registry)

1. **Equip flow**
   - Equip Leharis ring → bonus aggregators populated correctly
   - Unequip via transfer → aggregators reverted
   - Equip below `minLevel` → refunded, no aggregator change
   - Equip beyond `stackLimit` → refunded
   - Equip with full inventory → refunded

2. **Consumable flow**
   - HEAL potion when alive → HP restored, capped at maxHP, token burned
   - HEAL potion when dead → refund, no HP change
   - REVIVE potion when dead → HP restored to N% of maxHP, isDead cleared, token burned
   - REVIVE potion when alive → refund

3. **Forward compatibility**
   - Effect registered with unknown mode → applied effect is ignored, character state unchanged

---

## Out of Scope (deferred to later)

- `MODE_TEMP_BUFF` (timed reversion of bonuses)
- `MODE_DAMAGE_OVER_TIME`
- `MODE_CONDITIONAL` (e.g. "+10% damage when HP < 30%")
- Frontend item-card rendering
- Catalog/inventory listing UI
- On-chain item-discovery for off-chain consumers (no "list all registered items" — Gamemaster maintains an off-chain catalog)