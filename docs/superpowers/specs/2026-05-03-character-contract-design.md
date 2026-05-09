# Character Contract — Design Spec
**Date:** 2026-05-03  
**Status:** Approved  
**Scope:** Phase 1 — Smart Contracts only (Frontend in subsequent phases)

---

## Overview

Players can create a **Character Contract** — an on-chain smart contract that acts as their RPG persona. Instead of attacking a Construct directly with their native Signum wallet, players fund and operate a Character that attacks on their behalf, accumulates attributes, levels up, receives item drops, and can take damage from Construct counter-attacks.

The Character is a digital equivalent of a pen-and-paper RPG character sheet, fully on-chain.

---

## Architecture

### New Contracts

| Contract | Role |
|---|---|
| `character.contract.smart.c` | Thin proxy + state store. Forwards attacks, processes incoming messages from Construct, manages owner interactions, maintains inventory. |
| `item-registry.contract.smart.c` | Global singleton deployed once by Gamemaster. Stores item definitions (type, effect, stack limit, level requirement, burnability). |
| `construct.contract.smart.c` | Extended with Character detection, attribute-aware damage, counter-attack damage messages, item drops. |

### Attack Flow

```
Player Wallet  ──TX (SIGNA + opt. 1 Token)──▶  Character Contract
Character      ──forward (SIGNA + opt. Token)──▶  Construct
Construct      ──getCodeHashOf(sender) == knownCharacterHash?
  yes → reads attributes from Character KKV, applies modifiers
  no  → existing attack logic unchanged
Construct      ──XP Tokens + HP Tokens──▶  Character
Construct      ──counter-attack message (opt.)──▶  Character
Construct      ──item drop token (opt.)──▶  Character
Character      ──updates KKV (HP, status effects)
```

**Note:** A Character contract can only send SIGNA + 1 asset per transaction (Signum contract limitation), vs. a normal account which can send SIGNA + 3 assets. This is acceptable — the primary attack flow remains the same.

### Character Detection

The Construct identifies a Character attacker using:
```c
long isCharacter = (getCodeHashOf(currentTx.sender) == knownCharacterHash);
```


`knownCharacterHash` is a `long` (signed 64-bit integer) that is set by the Gamemaster on a global registry contract. The Construct checks the hash of the sender's code against this value. 

`knownCharacterHash` is **configurable by the Construct creator** to allow updates when a new Character contract version is deployed.

---

## Character State (KKV Maps)

### Shared Constants (both contracts must use identical keys)

```c
// Attributes
#define MAP_CHAR_STRENGTH    1
#define MAP_CHAR_STAMINA     2
#define MAP_CHAR_DEXTERITY   3
#define MAP_CHAR_LUCK        4
#define MAP_CHAR_WILLPOWER   5

// Combat state
#define MAP_CHAR_HP          200
#define MAP_CHAR_MAX_HP      201
#define MAP_CHAR_IS_DEAD     202
#define MAP_CHAR_LEVEL       203
#define MAP_CHAR_SKILL_PTS   204  // unspent skill points

// Status effects (temporary)
#define MAP_CHAR_FROZEN_UNTIL   300
#define MAP_CHAR_STUNNED_UNTIL  301
#define MAP_CHAR_DEBUFF_STACKS  302

// Item passive effects (Phase 2 — deferred)
// MAP_CHAR_ITEM_FIRE_DMG  400
// MAP_CHAR_ITEM_POISON    401
```

**XP is NOT stored in KKV.** XP = `getAssetBalance(this, xpTokenId)`. XP tokens are native Signum tokens — transferable, tradeable. This is intentional: players can buy/sell XP tokens, creating a real market value.

---

## Attributes

**Starting points:** 10  
**Minimum per attribute:** 0  
**Maximum per attribute:** 5  
**Most extreme build:** 5/5/0/0/0 (two attributes maxed, rest ignored)

### Attribute Effects

| Attribute | Per-Point Effect | Threshold (5 pts) Ability |
|---|---|---|
| **Strength** | +X% damage | *Berserk* — Crit chance |
| **Stamina** | +X max HP | *Fortified* — Damage received –20% |
| **Dexterity** | –X blocks cooldown | *Evasion* — Counter-attack chance –30% |
| **Luck** | +X% item drop chance | *Fortune* — Golden Crit (3× damage) possible |
| **Willpower** | –X% debuff duration, +X% token effect strength | *Iron Will* — one-time Freeze/Stun immunity per fight |

*Exact multiplier values (X) to be tuned during testing.*

The Construct reads attributes directly from the Character's KKV via `getExtMapValue`:
```c
long str = getExtMapValue(MAP_CHAR_STRENGTH, 0, currentTx.sender);
long dex = getExtMapValue(MAP_CHAR_DEXTERITY, 0, currentTx.sender);
long lck = getExtMapValue(MAP_CHAR_LUCK,      0, currentTx.sender);
long sta = getExtMapValue(MAP_CHAR_STAMINA,   0, currentTx.sender);
long wil = getExtMapValue(MAP_CHAR_WILLPOWER, 0, currentTx.sender);
damage = applyCharacterModifiers(damage, str, dex, lck, sta, wil);
```

No changes to the attack message format — the Construct pulls attributes on its own.

---

## Leveling

XP level is cached in `MAP_CHAR_LEVEL` and updated whenever the Character receives XP tokens. On XP receipt, the Character recomputes its level and increments `MAP_CHAR_SKILL_PTS` for each new level reached:
```c
long xp = getAssetBalance(this, xpTokenId);
long newLevel = computeLevel(xp); // reads threshold table from KKV
if (newLevel > MAP_CHAR_LEVEL) {
    MAP_CHAR_SKILL_PTS += (newLevel - MAP_CHAR_LEVEL);
    MAP_CHAR_LEVEL = newLevel;
}
```

**Default threshold table** (configurable via admin function):
```
Level 2:   1,000 XP
Level 3:   2,000 XP
Level 4:   4,000 XP
Level 5:   8,000 XP
Level N:   1000 * 2^(N-1)
```

Each level-up grants 1 unspent skill point (`MAP_CHAR_SKILL_PTS += 1`). The owner distributes points via `ALLOCATE_SKILL(attrIndex)`.

The level threshold table is stored in the Character contract's KKV and is settable by the owner, allowing game balance changes without contract redeployment.

---

## Counter-Attack (Construct → Character)

When the Construct determines a counter-attack should occur against a Character, instead of adding a debuff stack (existing non-Character behavior), it sends a message transaction:

```c
// message format sent to Character
message[0] = COUNTER_ATTACK  // magic code
message[1] = damageAmount
message[2] = statusEffect    // 0=none, 1=frozen, 2=stunned, 3=weakened
message[3] = statusDuration  // in blocks
```

The Character contract processes this in its main loop:
1. Reduces `MAP_CHAR_HP` by `damageAmount`
2. Writes status effect to KKV with expiry block
3. If `MAP_CHAR_HP <= 0`: triggers death sequence

**Counter-attack probability** uses the existing `shouldCounterAttack` logic (probabilistic + rage mode when breach limit exceeded), extended for Characters:
- Base chance modified by Character's Dexterity (Evasion threshold ability reduces by 30%)
- Rage mode (Construct HP < 30%): chance increases significantly

---

## Death & Revival

### Death Sequence
When `MAP_CHAR_HP <= 0`:
1. `MAP_CHAR_IS_DEAD = 1`
2. Penalty: random 1–3 skill points deducted from random non-zero attributes
3. Character refunds all incoming attack transactions while dead

**Randomness for penalty** — must use `>> 1` to avoid negative modulo:
```c
long penaltyPoints = (getWeakRandomNumber() >> 1) % 3 + 1;  // 1–3
long targetAttr    = (getWeakRandomNumber() >> 1) % 5;       // 0–4
```
No attribute can go below 0.

### Revival
Owner sends Revival Token to Character:
1. Character checks `currentTx.assetIds[0] == revivalTokenId`
2. `MAP_CHAR_IS_DEAD = 0`
3. `MAP_CHAR_HP = MAP_CHAR_MAX_HP`
4. Revival Token burned: `sendQuantity(1, revivalTokenId, ZERO)`

`revivalTokenId` is a native Signum token, configured at Character deploy time (similar to `xpTokenId` in Construct). It is intentionally expensive/rare.

---

## Item Drops

After a successful Character attack, the Construct checks for a drop:

```c
long luck = getExtMapValue(MAP_CHAR_LUCK, 0, currentTx.sender);
long dropChance = BASE_DROP_CHANCE + (luck * LUCK_BONUS_PER_POINT);
if ((getWeakRandomNumber() >> 1) % 100 < dropChance) {
    long balance = getAssetBalance(dropTokenId);  // THIS contract's balance
    if (balance > 0) {
        sendQuantity(1, dropTokenId, currentTx.sender);  // to Character
    }
}
```

**Drop pools:** The Construct can hold multiple drop tokens, configurable by the Creator via `SETDROPTOKEN(slot, tokenId)`. `getAssetBalance` checks whether supply remains before dropping.

**Using items:**
- **In combat:** Owner sends item token with attack TX to Character → Character forwards to Construct (existing Damage Modifier flow)
- **Trading:** Owner calls `COLLECT_ITEMS(tokenId)` → Character sends token(s) to Owner wallet for DeFi trading

---

## Character Contract: Method Reference

### Owner-callable (incoming TX from Creator)

| Method | Message[0] | Description |
|---|---|---|
| `ATTACK` | 1 | Forward SIGNA + opt. token to target Construct |
| `ALLOCATE_SKILL` | 2 | Spend 1 unspent skill point on `message[1]` attribute index |
| `COLLECT_ITEMS` | 3 | Send `message[1]` token balance to Owner wallet |
| `MIGRATE` | 4 | Copy attributes from `message[1]` (old Character contract ID) |
| `EMERGENCY_WITHDRAW` | 5 | Send all SIGNA + tokens to Owner wallet |
| `SET_LEVEL_THRESHOLD` | 6 | Configure level XP table entry: `message[1]` = level, `message[2]` = XP required |

### Incoming from Construct

| Event | Message[0] | Action |
|---|---|---|
| `COUNTER_ATTACK` | 100 | Reduce HP, apply status effect |
| `ITEM_DROP` | 101 | Informational only in Phase 1 — token already received via transfer |
| `BUFF` | 102 | Write positive KKV effect with expiry block |
| `DEBUFF` | 103 | Write negative KKV effect with expiry block |

---

## Construct Extensions

### New Admin Methods

| Method | Code | Notes |
|---|---|---|
| `SETCHARACTERHASH` | 13 | `message[1]` = signed long code hash (can be negative!) |
| `SETDROPTOKEN` | 14 | `message[1]` = slot index, `message[2]` = tokenId |
| `SETDROPCHANCE` | 15 | `message[1]` = base drop chance % |

### Changes to `runAttackerRound()`

```c
long isCharacter = (getCodeHashOf(currentTx.sender) == knownCharacterHash);

long damage = applyTokenModifiers(calculateSignaDamage());

if (isCharacter) {
    damage = applyCharacterModifiers(damage, currentTx.sender);
}

// ... existing breach limit, defeat check, XP/HP token send ...

if (shouldCounterAttack(preBreachDamage)) {
    if (isCharacter) {
        executeCharacterCounterAttack(currentTx.sender);
    } else {
        executeCounterAttack();  // existing debuff-stack logic
    }
}

if (isCharacter) {
    tryItemDrop(currentTx.sender);
}
```

### Bug Fix: `shouldCounterAttack`

Existing code has a bug — negative random values always trigger the counter-attack:
```c
// BEFORE (buggy)
long random = getWeakRandomNumber() % 100;

// AFTER (fixed)
long random = (getWeakRandomNumber() >> 1) % 100;
```

All uses of `getWeakRandomNumber()` in both contracts must use `>> 1` before modulo operations.

---

## Migration

When a Character contract needs to be replaced (e.g. bug fix):

1. Owner deploys new Character contract
2. Owner calls `MIGRATE(oldCharacterId)` on **new** contract
   - New contract reads all attribute KKV values from old contract via `getMapValue(oldCharacterId, key)`
   - Copies them into its own KKV
3. Owner calls `EMERGENCY_WITHDRAW` on old contract → all tokens/SIGNA returned to Owner wallet
4. Owner loads new contract with those tokens

The new contract's `MIGRATE` function knows the old contract's KKV schema (it is the evolution of it). No complex cross-contract token transfer required.

---

## Testing Strategy

All contract logic must be thoroughly tested before any frontend work begins.

### 1. Unit Tests (Testbed mode)
- `applyCharacterModifiers` — each attribute, boundary values (0, 5), threshold abilities
- `tryItemDrop` — drop chance math, empty pool, Luck interaction
- `executeCharacterCounterAttack` — damage calculation, status effect writing
- `ALLOCATE_SKILL` — valid/invalid attribute index, no unspent points, max cap
- Death sequence — penalty randomness, `IS_DEAD` flag, attack refund while dead
- Revival — token validation, HP restore, token burn
- `MIGRATE` — attribute copy correctness

### 2. Integration Tests (Character ↔ Construct)
- Character attack recognized via code hash
- Attributes correctly read from Character KKV and applied to damage
- Counter-attack message received and processed by Character
- Item drop token lands in Character (verified via `getAssetBalance`)
- Normal account attack still works unchanged
- `knownCharacterHash` update via `SETCHARACTERHASH`

### 3. Regression Tests (existing Construct behavior)
- Existing non-Character attacks unaffected
- Debuff system unchanged for non-Characters
- All existing admin methods still work
- `shouldCounterAttack` fix does not change probability distribution significantly

### 4. Migration Test
- Deploy v1 Character, set attributes, accumulate XP tokens
- Deploy v2 Character, call `MIGRATE(v1Id)`
- Verify all attributes copied correctly
- Verify Emergency Withdraw returns tokens

---

## Item Registry Contract

A single global contract deployed once by the Gamemaster. All Characters and Constructs read from it. Attack modifier tokens (Laser, Ice, Fire) remain in Construct-specific KKV as before — the registry handles Character equipment and consumables only.

### Contract Overview

| Contract | Deployed by | Scope |
|---|---|---|
| `construct.contract.smart.c` | Gamemaster (per season) | Boss fight, reads Character KKV for aggregated bonuses |
| `character.contract.smart.c` | Player | RPG character, reads Item Registry on item receipt |
| `item-registry.contract.smart.c` | Gamemaster (once, global) | Item definitions — Gamemaster registers new items here |

### Registry KKV Structure (key1 = property constant, key2 = tokenId)

```c
#define REGISTRY_ITEM_TYPE        1   // 1=equipment, 2=consumable
#define REGISTRY_EFFECT_TARGET    2   // 0=attack, 1=HP, 2=STR, 3=STA, 4=DEX, 5=LCK, 6=WIL, 7=inv_slots
#define REGISTRY_BONUS_ABS        3   // absolute bonus: +50 HP, +1 Strength
#define REGISTRY_BONUS_REL        4   // relative bonus: 120=+20%, 90=−10% malus
#define REGISTRY_STACK_LIMIT      5   // max of this token type per Character (1 = unique)
#define REGISTRY_MIN_LEVEL        6   // minimum Character level required to hold
#define REGISTRY_IS_BURNABLE      7   // 1 = consumed on use, sent to Creator
```

Gamemaster registers an item by sending a message to the Registry with the tokenId and property values. The Registry stores them in its KKV map.

### Item Examples

| Item | Type | Target | Bonus | Stack | Burnable |
|---|---|---|---|---|---|
| Shadow Dagger | Equipment | Attack | +15% (rel=115) | 3 | No |
| Fire Blade | Equipment | Attack | +30 abs dmg | 1 (unique) | No |
| Healing Potion | Consumable | HP | +100 abs HP | 5 | Yes |
| Stamina Shard | Consumable | STA | +1 abs | 1 | Yes |
| Adventurer's Pack | Equipment | inv_slots | +5 abs | 1 (unique) | No |

---

## Inventory System

### Slot Tracking

```c
MAP_CHAR_INVENTORY_COUNT      // currently occupied slots
MAP_CHAR_MAX_INVENTORY_SLOTS  // default 10, expandable via items
```

Inventory count is maintained by the Character contract on every item receipt and removal. The token balance (`getAssetBalance`) is the source of truth for how many of each token are held — no separate per-token KKV counter is needed.

### Receiving an Item

When the Character receives an item token:

```c
long limit   = getExtMapValue(REGISTRY_STACK_LIMIT, tokenId, ITEM_REGISTRY_ID);
long current = getAssetBalance(tokenId);  // THIS contract's (Character's) own balance
long level   = MAP_CHAR_LEVEL;
long minLvl  = getMapValue(REGISTRY_ID, REGISTRY_MIN_LEVEL, tokenId);
long maxSlots = MAP_CHAR_MAX_INVENTORY_SLOTS;

// Level check
if (level < minLvl) { refund; return; }

// Stack limit check
long incoming = getQuantity(currentTx.txId, tokenId);
long canAccept = limit - current;
if (canAccept <= 0) { refund all; return; }
if (incoming > canAccept) { refund excess; incoming = canAccept; }

// Inventory slot check
long slotsNeeded = incoming;
if (MAP_CHAR_INVENTORY_COUNT + slotsNeeded > maxSlots) { refund; return; }

// Accept: update inventory count and aggregated bonus KKV
MAP_CHAR_INVENTORY_COUNT += incoming;
updateEquipmentBonuses(tokenId, incoming, +1);  // +1 = adding
```

### Aggregated Equipment Bonuses in Character KKV

Instead of the Construct checking every possible item token balance, the Character maintains pre-aggregated bonus totals. These are updated on every item receive, use, or discard.

```c
MAP_CHAR_EQUIP_ATK_ABS     // total absolute attack bonus from equipment
MAP_CHAR_EQUIP_ATK_REL     // total relative attack bonus (cumulative %)
MAP_CHAR_EQUIP_HP_ABS      // total HP bonus
MAP_CHAR_EQUIP_STR_BONUS   // strength bonus from equipment
MAP_CHAR_EQUIP_STA_BONUS   // stamina bonus
MAP_CHAR_EQUIP_DEX_BONUS   // dexterity bonus
MAP_CHAR_EQUIP_LCK_BONUS   // luck bonus
MAP_CHAR_EQUIP_WIL_BONUS   // willpower bonus
```

The Construct reads these aggregated values on each Character attack — no need to enumerate individual item tokens.

### Using a Consumable

```c
// Owner sends: USE_ITEM message with tokenId in message[1]
long itemType = getMapValue(REGISTRY_ID, REGISTRY_ITEM_TYPE, tokenId);
if (itemType != ITEM_TYPE_CONSUMABLE) { return; }
if (getAssetBalance(this, tokenId) == 0) { return; }  // not held

long target = getMapValue(REGISTRY_ID, REGISTRY_EFFECT_TARGET, tokenId);
long bonusAbs = getMapValue(REGISTRY_ID, REGISTRY_BONUS_ABS, tokenId);

// Apply effect
if (target == TARGET_HP) {
    MAP_CHAR_HP = min(MAP_CHAR_HP + bonusAbs, MAP_CHAR_MAX_HP);
} else if (target == TARGET_ATTR) {
    // increment the attribute
}

// Burn: send to address zero (Signum burn address)
sendQuantity(1, tokenId, ZERO);
MAP_CHAR_INVENTORY_COUNT -= 1;
// updateEquipmentBonuses not needed for consumables (no passive effect)
```

### Inventory-Expanding Items

An item with `EFFECT_TARGET = 7 (inv_slots)` and `BONUS_ABS = 5` expands the Character's inventory by 5 slots when equipped. On receipt: `MAP_CHAR_MAX_INVENTORY_SLOTS += bonusAbs`. On removal: `MAP_CHAR_MAX_INVENTORY_SLOTS -= bonusAbs` (if current count allows).

---

## Out of Scope (Phase 1)

- Frontend for Character creation
- Character sheet UI
- Wallet integration for Character deployment
- Leaderboard integration for Character stats

These follow in subsequent phases, after contracts are tested and stable.
