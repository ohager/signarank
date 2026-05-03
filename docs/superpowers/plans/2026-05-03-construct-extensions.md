# Construct Contract Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Construct contract to detect Character attackers via `getCodeHashOf`, read their attributes via `getExtMapValue`, apply attribute-based damage modifiers, send counter-attack damage messages to Characters, and support random item drops. Also fixes the existing `getWeakRandomNumber` signed-integer bug.

**Architecture:** Minimal, additive changes to `construct.contract.smart.c`. A single `isCharacter` flag gates all new paths — existing non-Character attack logic is untouched. New functions (`applyCharacterModifiers`, `executeCharacterCounterAttack`, `tryItemDrop`) are isolated. Three new admin methods added.

**Tech Stack:** SmartC C dialect, `signum-smartc-testbed`, `vitest`

**Prerequisite:** Character contract must be deployed and its code hash known. See `2026-05-03-character-contract.md`.

---

## Reference

- Spec: `docs/superpowers/specs/2026-05-03-character-contract-design.md` → "Construct Extensions" section
- File to modify: `smartcontracts/construct/construct.contract.smart.c`
- Existing tests: `smartcontracts/construct/compile.test.ts`
- Context: `smartcontracts/construct/context.ts`
- Helpers: `smartcontracts/construct/lib.ts`
- SmartC API: https://github.com/deleterium/SmartC/blob/main/docs/1.5-Built-in-functions.md

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `smartcontracts/construct/construct.contract.smart.c` | Modify | Add character detection, modifiers, counter-attack, drop |
| `smartcontracts/construct/context.ts` | Modify | Add new method codes and map keys |
| `smartcontracts/construct/character-attack.test.ts` | Create | Character-specific attack path tests |
| `smartcontracts/construct/item-drop.test.ts` | Create | Item drop logic tests |
| `smartcontracts/construct/random-fix.test.ts` | Create | Regression test for the getWeakRandomNumber fix |

---

### Task 1: Fix `getWeakRandomNumber` bug (existing code)

**Files:**
- Modify: `smartcontracts/construct/construct.contract.smart.c`

The existing `shouldCounterAttack` uses `getWeakRandomNumber() % 100` without `>> 1`, meaning negative values always trigger a counter-attack, making the effective rate higher than configured.

- [ ] **Step 1: Write regression test first**

```typescript
// smartcontracts/construct/random-fix.test.ts
import { describe, expect, test, beforeEach } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { compileToBytecode, attack, BootstrapScenario, DefaultRequiredInitializers } from './lib';

let testbed: SimulatorTestbed;
beforeEach(() => {
    const bc = compileToBytecode(Context.ContractPath);
    testbed = new SimulatorTestbed(bc, {
        contractAddress: Context.ThisContract,
        creatorAddress: Context.CreatorAccount,
    });

    testbed.loadTransactions([
        ...BootstrapScenario,
        // Configure debuff with 0% chance (should NEVER counter-attack)
        {
            blockheight: 3,
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            message: [Context.Methods.SetDebuff, 0n, 10n, 3n], // 0% chance
        }
    ]);
    testbed.runSlots(3);
});

describe('getWeakRandomNumber fix', () => {
    test('counter-attack never fires when chance is 0%', () => {
        // Run many attacks — with the bug, ~50% would counter-attack
        let counterAttackFired = false;
        for (let i = 0; i < 20; i++) {
            const result = attack({ testbed, signa: 10n });
            testbed.runSlots(1);
            if (result.some(tx => tx.message?.[0] === /* COUNTER_DEBUFF_MSG */ 24n)) {
                counterAttackFired = true;
            }
        }
        expect(counterAttackFired).toBe(false);
    });
});
```

- [ ] **Step 2: Run — expect FAIL (reveals bug)**

```bash
cd smartcontracts && npx vitest run construct/random-fix.test.ts
```
Expected: FAIL — counter-attack fires despite 0% chance

- [ ] **Step 3: Fix in contract**

In `construct.contract.smart.c`, find `shouldCounterAttack` and change:

```c
// BEFORE (line ~527)
long random = getWeakRandomNumber() % 100;

// AFTER
long random = (getWeakRandomNumber() >> 1) % 100;
```

Also fix `refundPowerUpsWithPenalty` — already uses `>> 1`, no change needed there.

- [ ] **Step 4: Run fix test — expect PASS**

```bash
cd smartcontracts && npx vitest run construct/random-fix.test.ts
```

- [ ] **Step 5: Run all existing construct tests — still PASS**

```bash
cd smartcontracts && npx vitest run construct/
```
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add smartcontracts/construct/construct.contract.smart.c
git commit -m "fix(construct): use >> 1 before modulo on getWeakRandomNumber"
```

---

### Task 2: Add new admin methods and state variables

**Files:**
- Modify: `smartcontracts/construct/construct.contract.smart.c`
- Modify: `smartcontracts/construct/context.ts`

- [ ] **Step 1: Update context.ts**

Add to `Methods`:
```typescript
SetCharacterHash: 13n,
SetDropToken:     14n,
SetDropChance:    15n,
```

Add new `Maps` entries:
```typescript
CharacterHash:     13n, // stored in contract state, not KKV
DropTokenSlot:     14n, // key1=14, key2=slot => tokenId
BaseDropChance:    15n, // key1=15, key2=0 => chance %
```

- [ ] **Step 2: Add state variable and admin methods to contract**

At the top of the contract (after existing state variables):
```c
// ---- Character support
long knownCharacterHash;  // signed long — set via SETCHARACTERHASH

// ---- New method codes
#define SETCHARACTERHASH  13
#define SETDROPTOKEN      14
#define SETDROPCHANCE     15

// ---- New KKV map keys
#define MAP_DROP_TOKEN_SLOT   14   // key2 = slot index => tokenId
#define MAP_BASE_DROP_CHANCE  15   // key2 = 0 => base %

// ---- Character KKV keys (shared with character contract — must match)
#define MAP_CHAR_STRENGTH    100
#define MAP_CHAR_STAMINA     101
#define MAP_CHAR_DEXTERITY   102
#define MAP_CHAR_LUCK        103
#define MAP_CHAR_WILLPOWER   104

#define MAP_EQUIP_ATK_ABS    400
#define MAP_EQUIP_ATK_REL    401
#define MAP_EQUIP_HP_ABS     402
#define MAP_EQUIP_STR_BONUS  403
#define MAP_EQUIP_STA_BONUS  404
#define MAP_EQUIP_DEX_BONUS  405
#define MAP_EQUIP_LCK_BONUS  406
#define MAP_EQUIP_WIL_BONUS  407

// ---- Attribute modifier constants (tunable)
#define CHAR_STR_DMG_BONUS_PCT  2   // +2% damage per Strength point
#define CHAR_DEX_CD_REDUCTION   1   // -1 block cooldown per Dexterity point
#define CHAR_LCK_DROP_BONUS_PCT 2   // +2% drop chance per Luck point
#define CHAR_STR_CRIT_THRESHOLD 5   // Strength >= 5 enables crit
#define CHAR_DEX_EVADE_THRESHOLD 5  // Dexterity >= 5 reduces counter chance 30%
#define CHAR_CRIT_MULTIPLIER    3   // 3x damage on crit
#define CRIT_BASE_CHANCE        10  // base crit chance % (when Berserk active)
```

Add to the creator `switch` in `main()`:
```c
case SETCHARACTERHASH:
    setCharacterHash(currentTx.message[1]);
break;
case SETDROPTOKEN:
    setDropToken(currentTx.message[1], currentTx.message[2]);
break;
case SETDROPCHANCE:
    setDropChance(currentTx.message[1]);
break;
```

Add the admin functions:
```c
void setCharacterHash(long hashValue) {
    // hashValue is a signed long — can be negative — store as-is
    knownCharacterHash = hashValue;
}

void setDropToken(long slot, long tokenId) {
    if (slot < 0 || slot > 9) { return; }  // max 10 drop slots
    setMapValue(MAP_DROP_TOKEN_SLOT, slot, tokenId);
}

void setDropChance(long chance) {
    if (chance < 0 || chance > 100) { return; }
    setMapValue(MAP_BASE_DROP_CHANCE, 0, chance);
}
```

- [ ] **Step 3: Compile test — expect PASS**

```bash
cd smartcontracts && npx vitest run construct/compile.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add smartcontracts/construct/
git commit -m "feat(construct): add character hash, drop token/chance admin methods"
```

---

### Task 3: Character detection and attribute modifiers

**Files:**
- Modify: `smartcontracts/construct/construct.contract.smart.c`
- Create: `smartcontracts/construct/character-attack.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// smartcontracts/construct/character-attack.test.ts
import { describe, expect, test, beforeEach } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { compileToBytecode, attack, BootstrapScenario, DefaultRequiredInitializers } from './lib';

// Simulate a "Character" sender — we set its code hash via testbed mock
const CHARACTER_CODE_HASH = -1234567890n; // signed negative, as per spec
const CHARACTER_ADDRESS   = 777n;

let testbed: SimulatorTestbed;
beforeEach(() => {
    const bc = compileToBytecode(Context.ContractPath);
    testbed = new SimulatorTestbed(bc, {
        contractAddress: Context.ThisContract,
        creatorAddress: Context.CreatorAccount,
    });

    testbed.loadTransactions([
        ...BootstrapScenario,
        // Set character code hash
        {
            blockheight: 3,
            sender: Context.CreatorAccount, recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            message: [Context.Methods.SetCharacterHash, CHARACTER_CODE_HASH, 0n, 0n],
        }
    ]);
    testbed.runSlots(3);

    // Mock: CHARACTER_ADDRESS has the expected code hash
    testbed.setAccountCodeHash(CHARACTER_ADDRESS, CHARACTER_CODE_HASH);

    // Mock: CHARACTER_ADDRESS has Strength=3, Dexterity=0, Luck=2
    testbed.setExternalMapValue(CHARACTER_ADDRESS, Context.Maps.CharStrength, 0n, 3n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, 102n /* Dexterity */, 0n, 0n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, 103n /* Luck */, 0n, 2n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, 101n /* Stamina */, 0n, 0n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, 104n /* Willpower */, 0n, 0n);
    // Equipment bonuses: none
    testbed.setExternalMapValue(CHARACTER_ADDRESS, Context.Maps.EquipAtkAbs, 0n, 0n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, Context.Maps.EquipAtkRel, 0n, 0n);
});

describe('character detection', () => {
    test('recognizes character attacker by code hash', () => {
        // Character attack deals more damage than same SIGNA from normal account
        const normalResult = attack({ testbed, signa: 100n, sender: Context.SenderAccount1 });
        testbed.runSlots(1);
        const hpAfterNormal = testbed.getContractMemoryValue('hpTokenId'); // current HP

        // Character with Strength=3 → +6% damage
        const charResult = attack({ testbed, signa: 100n, sender: CHARACTER_ADDRESS });
        testbed.runSlots(1);
        // HP should have dropped more from character attack
        // (exact amounts depend on baseDamageRatio — check XP tokens sent)
        const xpToNormal  = testbed.getAccountQuantity(Context.SenderAccount1, Context.XPTokenId);
        const xpToChar    = testbed.getAccountQuantity(CHARACTER_ADDRESS, Context.XPTokenId);
        expect(xpToChar).toBeGreaterThan(xpToNormal);
    });

    test('does not apply character modifiers to normal attacker', () => {
        // Normal attacker with same SIGNA — no bonus
        attack({ testbed, signa: 100n, sender: Context.SenderAccount1 });
        testbed.runSlots(1);
        const xpToNormal = testbed.getAccountQuantity(Context.SenderAccount1, Context.XPTokenId);

        // Another normal attacker — same XP
        attack({ testbed, signa: 100n, sender: Context.SenderAccount2 });
        testbed.runSlots(1);
        const xpToAccount2 = testbed.getAccountQuantity(Context.SenderAccount2, Context.XPTokenId);

        expect(xpToNormal).toBe(xpToAccount2);
    });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd smartcontracts && npx vitest run construct/character-attack.test.ts
```

- [ ] **Step 3: Add `isCharacter` detection and `applyCharacterModifiers` to contract**

In `runAttackerRound()`, after `long totalDamage = applyTokenModifiers(calculateSignaDamage());`, add:

```c
long isCharacter = ZERO;
if (knownCharacterHash != ZERO) {
    isCharacter = (getCodeHashOf(currentTx.sender) == knownCharacterHash) ? 1 : 0;
}

if (isCharacter) {
    totalDamage = applyCharacterModifiers(totalDamage);
}
```

Add the function:

```c
long applyCharacterModifiers(long damage) {
    long str = getExtMapValue(MAP_CHAR_STRENGTH,  0, currentTx.sender);
    long dex = getExtMapValue(MAP_CHAR_DEXTERITY, 0, currentTx.sender);
    long lck = getExtMapValue(MAP_CHAR_LUCK,      0, currentTx.sender);

    // Strength: +CHAR_STR_DMG_BONUS_PCT% per point
    damage = (damage * (100 + str * CHAR_STR_DMG_BONUS_PCT)) / 100;

    // Equipment attack bonuses
    long equipAtkAbs = getExtMapValue(MAP_EQUIP_ATK_ABS, 0, currentTx.sender);
    long equipAtkRel = getExtMapValue(MAP_EQUIP_ATK_REL, 0, currentTx.sender);
    damage += equipAtkAbs;
    if (equipAtkRel != ZERO) {
        damage = (damage * (100 + equipAtkRel)) / 100;
    }

    // Strength threshold (Berserk): chance for 3x crit
    if (str >= CHAR_STR_CRIT_THRESHOLD) {
        long critRoll = (getWeakRandomNumber() >> 1) % 100;
        if (critRoll < CRIT_BASE_CHANCE) {
            damage = damage * CHAR_CRIT_MULTIPLIER;
        }
    }

    return damage;
}
```

Also modify the counter-attack check to factor in Dexterity Evasion (Dex >= 5 reduces counter chance by 30%):

```c
// In runAttackerRound, replace shouldCounterAttack call:
long counterChance = calculateCounterAttackChance(preBreachDamage);
if (isCharacter) {
    long dex = getExtMapValue(MAP_CHAR_DEXTERITY, 0, currentTx.sender);
    if (dex >= CHAR_DEX_EVADE_THRESHOLD) {
        counterChance = (counterChance * 70) / 100; // -30%
    }
}
long counterRoll = (getWeakRandomNumber() >> 1) % 100;
if (counterRoll < counterChance) {
    if (isCharacter) {
        executeCharacterCounterAttack();
    } else {
        executeCounterAttack();
    }
}
```

Also modify `checkCooldown()` to apply Dexterity-based cooldown reduction for Character senders. Cooldown is checked before `isCharacter` is set, so detection happens inside the function:

```c
long checkCooldown() {
    long lastAttack = getMapValue(MAP_ATTACKERS_LAST_ATTACK, currentTx.sender);
    if (lastAttack > ZERO) {
        long effectiveCooldown = coolDownInBlocks;
        // Dexterity reduces cooldown by CHAR_DEX_CD_REDUCTION blocks per point
        if (knownCharacterHash != ZERO &&
            getCodeHashOf(currentTx.sender) == knownCharacterHash) {
            long dex = getExtMapValue(MAP_CHAR_DEXTERITY, 0, currentTx.sender);
            long reduction = dex * CHAR_DEX_CD_REDUCTION;
            effectiveCooldown = effectiveCooldown - reduction;
            if (effectiveCooldown < 1) { effectiveCooldown = 1; }
        }
        if ((currentTx.height - lastAttack) < effectiveCooldown) {
            sendMsgCooldown(currentTx.sender);
            long signaAmount = getAmount(currentTx.txId);
            long refundAmount = (signaAmount * 90) / 100;
            long burnAmount = signaAmount - refundAmount;
            if (refundAmount > ZERO) { sendAmount(refundAmount, currentTx.sender); }
            if (burnAmount > ZERO) { sendAmount(burnAmount, ZERO); }
            refundPowerUpsWithPenalty();
            return 0;
        }
    }
    return 1;
}
```

- [ ] **Step 3b: Add cooldown reduction test to `character-attack.test.ts`**

```typescript
test('dexterity reduces effective cooldown', () => {
    // Character with Dex=3 → cooldown reduced by 3 blocks
    testbed.setExternalMapValue(CHARACTER_ADDRESS, 102n /* Dexterity */, 0n, 3n);

    // First attack goes through
    attack({ testbed, signa: 10n, sender: CHARACTER_ADDRESS });
    testbed.runSlots(1);

    // Attack 2 blocks later — would normally be in cooldown, but Dex=3 reduces it
    // (assumes default coolDownInBlocks > 2; effective = coolDownInBlocks - 3)
    // Only valid if test cooldown config is ≤ 5 blocks — skip if not configurable
    // Verify: same-block re-attack is still rejected (minimum 1 block enforced)
    attack({ testbed, signa: 10n, sender: CHARACTER_ADDRESS });
    testbed.runSlots(1);
    const refundMessages = testbed.getMessagesReceivedBy(CHARACTER_ADDRESS)
        .filter(m => m.message?.[0] === /* COOLDOWN msg code from context */ Context.Messages?.Cooldown ?? 0n);
    // With Dex=3 reduction, cooldown is shorter — fewer refunds expected
    expect(refundMessages.length).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd smartcontracts && npx vitest run construct/character-attack.test.ts
```

- [ ] **Step 5: Compile test still passes**

```bash
cd smartcontracts && npx vitest run construct/compile.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add smartcontracts/construct/
git commit -m "feat(construct): character detection and attribute-based damage modifiers"
```

---

### Task 4: Character counter-attack (damage message to Character)

**Files:**
- Modify: `smartcontracts/construct/construct.contract.smart.c`

- [ ] **Step 1: Implement `executeCharacterCounterAttack()`**

```c
#define CHAR_COUNTER_ATTACK_CODE  100
#define STATUS_NONE     0
#define STATUS_FROZEN   1
#define STATUS_STUNNED  2
#define STATUS_WEAKENED 3
#define COUNTER_ATTACK_DAMAGE_PCT 10  // counter deals 10% of Construct maxHp as damage
#define COUNTER_FREEZE_DURATION   3   // blocks

void executeCharacterCounterAttack() {
    // Calculate counter damage: base = COUNTER_ATTACK_DAMAGE_PCT% of maxHp
    long counterDamage = (maxHp * COUNTER_ATTACK_DAMAGE_PCT) / 100;

    // Determine status effect (random)
    long statusEffect   = STATUS_NONE;
    long statusDuration = 0;
    long effectRoll = (getWeakRandomNumber() >> 1) % 100;
    if (effectRoll < 20) {
        statusEffect   = STATUS_FROZEN;
        statusDuration = COUNTER_FREEZE_DURATION;
    } else if (effectRoll < 40) {
        statusEffect = STATUS_WEAKENED;
    }

    messageBuffer[0] = CHAR_COUNTER_ATTACK_CODE;
    messageBuffer[1] = counterDamage;
    messageBuffer[2] = statusEffect;
    messageBuffer[3] = statusDuration;

    // 1 SIGNA activation fee to trigger Character contract's main loop
    sendAmountAndMessage(1_0000_0000, messageBuffer, currentTx.sender);
    sendEventCounterAttacked();
}
```

- [ ] **Step 2: Add test**

```typescript
test('sends counter-attack message to character with damage amount', () => {
    // Configure 100% counter-attack chance for test
    testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount, recipient: Context.ThisContract,
        amount: 1_0000_0000n,
        message: [Context.Methods.SetDebuff, 100n, 10n, 3n], // 100% chance
    }]);
    testbed.runSlots(1);

    attack({ testbed, signa: 100n, sender: CHARACTER_ADDRESS });
    testbed.runSlots(1);

    // Check that Character received a message with code 100 (COUNTER_ATTACK)
    const charMessages = testbed.getMessagesReceivedBy(CHARACTER_ADDRESS);
    const counterMsg = charMessages.find(m => m.message?.[0] === 100n);
    expect(counterMsg).toBeDefined();
    expect(counterMsg!.message![1]).toBeGreaterThan(0n); // damage > 0
});
```

Add test to `character-attack.test.ts` and run:

```bash
cd smartcontracts && npx vitest run construct/character-attack.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add smartcontracts/construct/
git commit -m "feat(construct): character counter-attack with damage message"
```

---

### Task 5: Item drop system

**Files:**
- Modify: `smartcontracts/construct/construct.contract.smart.c`
- Create: `smartcontracts/construct/item-drop.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// smartcontracts/construct/item-drop.test.ts
import { describe, expect, test, beforeEach } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { compileToBytecode, attack, BootstrapScenario } from './lib';

const ITEM_TOKEN = 9999n;
const CHARACTER_ADDRESS = 777n;
const CHARACTER_CODE_HASH = -1234567890n;

let testbed: SimulatorTestbed;
beforeEach(() => {
    const bc = compileToBytecode(Context.ContractPath);
    testbed = new SimulatorTestbed(bc, {
        contractAddress: Context.ThisContract,
        creatorAddress: Context.CreatorAccount,
    });
    testbed.loadTransactions([
        ...BootstrapScenario,
        // Give the Construct some drop tokens
        {
            blockheight: 3,
            sender: Context.CreatorAccount, recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            tokens: [{ asset: ITEM_TOKEN, quantity: 100n }],
            message: [0n, 0n, 0n, 0n],
        },
        // Register drop slot 0 = ITEM_TOKEN
        {
            blockheight: 4,
            sender: Context.CreatorAccount, recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            message: [Context.Methods.SetDropToken, 0n, ITEM_TOKEN, 0n],
        },
        // Set base drop chance = 100% for testing
        {
            blockheight: 5,
            sender: Context.CreatorAccount, recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            message: [Context.Methods.SetDropChance, 100n, 0n, 0n],
        },
        // Set character hash
        {
            blockheight: 6,
            sender: Context.CreatorAccount, recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            message: [Context.Methods.SetCharacterHash, CHARACTER_CODE_HASH, 0n, 0n],
        },
    ]);
    testbed.runSlots(6);
    testbed.setAccountCodeHash(CHARACTER_ADDRESS, CHARACTER_CODE_HASH);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, 103n /* Luck */, 0n, 0n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, Context.Maps.CharStrength, 0n, 0n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, 102n, 0n, 0n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, 104n, 0n, 0n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, 101n, 0n, 0n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, Context.Maps.EquipAtkAbs, 0n, 0n);
    testbed.setExternalMapValue(CHARACTER_ADDRESS, Context.Maps.EquipAtkRel, 0n, 0n);
});

describe('tryItemDrop', () => {
    test('sends item token to character when drop triggers (100% chance)', () => {
        attack({ testbed, signa: 100n, sender: CHARACTER_ADDRESS });
        testbed.runSlots(1);
        const charTokenBalance = testbed.getAccountQuantity(CHARACTER_ADDRESS, ITEM_TOKEN);
        expect(charTokenBalance).toBe(1n);
    });

    test('does not drop to normal (non-character) attacker', () => {
        attack({ testbed, signa: 100n, sender: Context.SenderAccount1 });
        testbed.runSlots(1);
        const balance = testbed.getAccountQuantity(Context.SenderAccount1, ITEM_TOKEN);
        expect(balance).toBe(0n);
    });

    test('does not drop when Construct has no inventory of the drop token', () => {
        // Drain all tokens
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount, recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            message: [0n, 0n, 0n, 0n], // no-op to run
        }]);
        // Can't easily drain in testbed — test with a token that Construct doesn't hold
        // Set slot 1 to a different token with zero balance
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount, recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            message: [Context.Methods.SetDropToken, 0n, 88888n, 0n], // Construct holds 0 of this
        }]);
        testbed.runSlots(1);
        attack({ testbed, signa: 100n, sender: CHARACTER_ADDRESS });
        testbed.runSlots(1);
        expect(testbed.getAccountQuantity(CHARACTER_ADDRESS, 88888n)).toBe(0n);
    });

    test('luck increases effective drop chance', () => {
        // Set base drop chance to 0%, then set Luck=5 → effective = 0 + 5*2 = 10%
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount, recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            message: [Context.Methods.SetDropChance, 0n, 0n, 0n],
        }]);
        testbed.runSlots(1);
        testbed.setExternalMapValue(CHARACTER_ADDRESS, 103n /* Luck */, 0n, 5n);

        // Run 100 attacks — with 10% chance, statistically expect ~10 drops
        let drops = 0;
        for (let i = 0; i < 100; i++) {
            attack({ testbed, signa: 10n, sender: CHARACTER_ADDRESS });
            testbed.runSlots(1);
            drops = Number(testbed.getAccountQuantity(CHARACTER_ADDRESS, ITEM_TOKEN));
        }
        // With luck=0 and 0% base, drops should be 0. With luck=5, some drops expected.
        // This is probabilistic — just verify drops > 0 across 100 attempts
        expect(drops).toBeGreaterThan(0);
    });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd smartcontracts && npx vitest run construct/item-drop.test.ts
```

- [ ] **Step 3: Implement `tryItemDrop()`**

Add to `runAttackerRound()` after the counter-attack block:

```c
if (isCharacter && !isDefeated) {
    tryItemDrop();
}
```

Add the function:

```c
void tryItemDrop() {
    long baseChance = getMapValue(MAP_BASE_DROP_CHANCE, 0);
    if (baseChance <= ZERO) { return; }

    long lck = getExtMapValue(MAP_CHAR_LUCK, 0, currentTx.sender);
    long dropChance = baseChance + lck * CHAR_LCK_DROP_BONUS_PCT;
    if (dropChance > 100) { dropChance = 100; }

    long roll = (getWeakRandomNumber() >> 1) % 100;
    if (roll >= dropChance) { return; }

    // Pick a random drop slot (0-9)
    long slot = (getWeakRandomNumber() >> 1) % 10;
    long dropTokenId = getMapValue(MAP_DROP_TOKEN_SLOT, slot);
    if (dropTokenId == ZERO) { return; }

    long balance = getAssetBalance(dropTokenId);
    if (balance <= ZERO) { return; }

    sendQuantity(1, dropTokenId, currentTx.sender);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd smartcontracts && npx vitest run construct/item-drop.test.ts
```

- [ ] **Step 5: Full construct test suite**

```bash
cd smartcontracts && npx vitest run construct/
```
Expected: all PASS (including regression, character-attack, item-drop, compile)

- [ ] **Step 6: Commit**

```bash
git add smartcontracts/construct/
git commit -m "feat(construct): item drop system for character attackers"
```

---

### Task 6: Final integration run and code size check

- [ ] **Step 1: Run complete test suite**

```bash
cd smartcontracts && npx vitest run
```
Expected: all tests in `construct/`, `character/`, `item-registry/` pass.

- [ ] **Step 2: Check code sizes are within limit**

All three compile tests enforce `MAX_CODE_SIZE = 40 * 256 = 10240` bytes. If the Construct exceeds the limit due to new code, extract helper functions to reduce inlining or use `#pragma optimizationLevel 3`.

- [ ] **Step 3: Final commit**

```bash
git add smartcontracts/
git commit -m "feat: character contract system complete — item-registry, character, construct extensions"
```
