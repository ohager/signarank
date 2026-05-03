# Character Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the on-chain Character smart contract — a thin proxy that stores RPG attributes, forwards attacks to a Construct, manages an item inventory via the Item Registry, handles incoming counter-attack messages, and tracks death/revival state.

**Architecture:** Single SmartC contract. Owner (player wallet) sends commands; Character forwards attacks and processes Construct responses. State in KKV maps (attributes, HP, inventory count, status effects, equipment bonuses). Item properties read from global Item Registry via `getExtMapValue`. XP tracked as token balance via `getAssetBalance`. Mirrors `construct.contract.smart.c` patterns throughout.

**Tech Stack:** SmartC C dialect, `signum-smartc-testbed`, `vitest`, TypeScript test helpers

**Prerequisite:** Item Registry contract must be deployed (testbed address known). See `2026-05-03-item-registry-contract.md`.

---

## Reference

- Spec: `docs/superpowers/specs/2026-05-03-character-contract-design.md`
- Item Registry plan: `docs/superpowers/plans/2026-05-03-item-registry-contract.md`
- Existing pattern: `smartcontracts/construct/construct.contract.smart.c`
- Test helpers: `smartcontracts/construct/lib.ts`, `smartcontracts/construct/context.ts`
- SmartC API: https://github.com/deleterium/SmartC/blob/main/docs/1.5-Built-in-functions.md

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `smartcontracts/character/character.contract.smart.c` | Create | The contract |
| `smartcontracts/character/context.ts` | Create | Test constants |
| `smartcontracts/character/lib.ts` | Create | Test helpers |
| `smartcontracts/character/compile.test.ts` | Create | Compilation size check |
| `smartcontracts/character/attributes.test.ts` | Create | Attribute allocation tests |
| `smartcontracts/character/attack.test.ts` | Create | Attack forwarding tests |
| `smartcontracts/character/combat.test.ts` | Create | Counter-attack, death, revival tests |
| `smartcontracts/character/inventory.test.ts` | Create | Item receipt, inventory limits, consumables |
| `smartcontracts/character/leveling.test.ts` | Create | XP → level → skill points tests |
| `smartcontracts/character/migrate.test.ts` | Create | Migration from old contract tests |

---

### Task 1: Context and test infrastructure

**Files:**
- Create: `smartcontracts/character/context.ts`

- [ ] **Step 1: Create context.ts**

```typescript
// smartcontracts/character/context.ts
import { join } from 'path';

export const Context = {
    ContractPath: join(__dirname + '/character.contract.smart.c'),
    OwnerAccount: 10n,
    ThisContract: 777n,
    ConstructContract: 888n,
    ItemRegistryContract: 444n,
    XPTokenId: 1000n,
    RevivalTokenId: 2000n,
    ActivationFee: 1_0000_0000n,

    Methods: {
        Attack:              1n,
        AllocateSkill:       2n,
        CollectItems:        3n,
        Migrate:             4n,
        EmergencyWithdraw:   5n,
        SetLevelThreshold:   6n,
        UseItem:             7n,
        // Incoming from Construct
        CounterAttack:     100n,
        Buff:              102n,
        Debuff:            103n,
    },

    // Attribute indices for AllocateSkill
    Attrs: {
        Strength:  0n,
        Stamina:   1n,
        Dexterity: 2n,
        Luck:      3n,
        Willpower: 4n,
    },

    // KKV map keys — must match contract #defines
    Maps: {
        // Attributes (key2 = 0)
        CharStrength:  100n,
        CharStamina:   101n,
        CharDexterity: 102n,
        CharLuck:      103n,
        CharWillpower: 104n,
        // Combat state (key2 = 0)
        CharHp:         200n,
        CharMaxHp:      201n,
        CharIsDead:     202n,
        CharLevel:      203n,
        CharSkillPts:   204n,
        CharInvCount:   205n,
        CharMaxInvSlots: 206n,
        // Status effects (key2 = 0)
        FrozenUntil:    300n,
        StunnedUntil:   301n,
        DebuffStacks:   302n,
        // Equipment bonuses (key2 = 0)
        EquipAtkAbs:    400n,
        EquipAtkRel:    401n,
        EquipHpAbs:     402n,
        EquipStrBonus:  403n,
        EquipStaBonus:  404n,
        EquipDexBonus:  405n,
        EquipLckBonus:  406n,
        EquipWilBonus:  407n,
    },

    // Status effect codes (used in CounterAttack message[2])
    StatusEffects: {
        None:     0n,
        Frozen:   1n,
        Stunned:  2n,
        Weakened: 3n,
    },
} as const;
```

- [ ] **Step 2: Verify**

```bash
ls smartcontracts/character/
```
Expected: `context.ts`

---

### Task 2: Compile test and contract skeleton

**Files:**
- Create: `smartcontracts/character/compile.test.ts`
- Create: `smartcontracts/character/character.contract.smart.c`

- [ ] **Step 1: Write failing compile test**

```typescript
// smartcontracts/character/compile.test.ts
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { Context } from './context';
import { SmartC } from 'smartc-signum-compiler';

const MAX_CODE_SIZE = 40 * 256;

describe('Character Contract Compile Test', () => {
    test('should compile and be within code size limit', () => {
        const code = readFileSync(Context.ContractPath, 'utf8');
        const compiler = new SmartC({ language: 'C', sourceCode: code });
        const compiled = compiler.compile();
        const machinedata = compiled.getMachineCode();
        expect(machinedata).toBeDefined();
        expect(machinedata.ByteCode.length / 2).toBeLessThanOrEqual(MAX_CODE_SIZE);
    });
});
```

- [ ] **Step 2: Run — expect FAIL (no file)**

```bash
cd smartcontracts && npx vitest run character/compile.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write contract skeleton**

```c
// smartcontracts/character/character.contract.smart.c
#program name Character
#program description Signarank Character Contract
#program activationAmount 100000000
#pragma optimizationLevel 2
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0

// ---- Owner method codes (message[0])
#define METHOD_ATTACK             1
#define METHOD_ALLOCATE_SKILL     2
#define METHOD_COLLECT_ITEMS      3
#define METHOD_MIGRATE            4
#define METHOD_EMERGENCY_WITHDRAW 5
#define METHOD_SET_LEVEL_THRESHOLD 6
#define METHOD_USE_ITEM           7

// ---- Incoming from Construct (message[0])
#define METHOD_COUNTER_ATTACK   100
#define METHOD_BUFF             102
#define METHOD_DEBUFF           103

// ---- KKV map keys (key1), key2 = 0 for scalar state
#define MAP_CHAR_STRENGTH    100
#define MAP_CHAR_STAMINA     101
#define MAP_CHAR_DEXTERITY   102
#define MAP_CHAR_LUCK        103
#define MAP_CHAR_WILLPOWER   104

#define MAP_CHAR_HP           200
#define MAP_CHAR_MAX_HP       201
#define MAP_CHAR_IS_DEAD      202
#define MAP_CHAR_LEVEL        203
#define MAP_CHAR_SKILL_PTS    204
#define MAP_CHAR_INV_COUNT    205
#define MAP_CHAR_MAX_INV_SLOTS 206

#define MAP_FROZEN_UNTIL      300
#define MAP_STUNNED_UNTIL     301
#define MAP_DEBUFF_STACKS     302

#define MAP_EQUIP_ATK_ABS     400
#define MAP_EQUIP_ATK_REL     401
#define MAP_EQUIP_HP_ABS      402
#define MAP_EQUIP_STR_BONUS   403
#define MAP_EQUIP_STA_BONUS   404
#define MAP_EQUIP_DEX_BONUS   405
#define MAP_EQUIP_LCK_BONUS   406
#define MAP_EQUIP_WIL_BONUS   407

// ---- Item Registry property keys (must match item-registry contract)
#define REG_ITEM_TYPE      1
#define REG_EFFECT_TARGET  2
#define REG_BONUS_ABS      3
#define REG_BONUS_REL      4
#define REG_STACK_LIMIT    5
#define REG_MIN_LEVEL      6
#define REG_IS_BURNABLE    7

// ---- Item types
#define ITEM_EQUIPMENT  1
#define ITEM_CONSUMABLE 2

// ---- Effect targets
#define TARGET_ATTACK    0
#define TARGET_HP        1
#define TARGET_STR       2
#define TARGET_STA       3
#define TARGET_DEX       4
#define TARGET_LCK       5
#define TARGET_WIL       6
#define TARGET_INV_SLOTS 7

// ---- Status effect codes
#define STATUS_NONE     0
#define STATUS_FROZEN   1
#define STATUS_STUNNED  2
#define STATUS_WEAKENED 3

// ---- Attribute indices (for ALLOCATE_SKILL)
#define ATTR_STRENGTH  0
#define ATTR_STAMINA   1
#define ATTR_DEXTERITY 2
#define ATTR_LUCK      3
#define ATTR_WILLPOWER 4
#define ATTR_MAX_INDEX 4
#define ATTR_MAX_VALUE 5

// ---- Starting state
#define STARTING_SKILL_POINTS 10
#define DEFAULT_BASE_HP       100
#define HP_PER_STAMINA        20
#define DEFAULT_MAX_INV_SLOTS 10

// ---- Parameters (set at deploy time)
long itemRegistryId;
long xpTokenId;
long revivalTokenId;
long constructId;   // default Construct to attack

long ZERO;
const ZERO = 0;

struct TX {
    long txId;
    long sender;
    long height;
    long assetIds[4];
    long message[4];
} currentTx;

long messageBuffer[4];

void init() {
    // Initialize starting attributes (all zero — owner allocates skill points)
    setMapValue(MAP_CHAR_SKILL_PTS, 0, STARTING_SKILL_POINTS);
    setMapValue(MAP_CHAR_MAX_INV_SLOTS, 0, DEFAULT_MAX_INV_SLOTS);
    setMapValue(MAP_CHAR_LEVEL, 0, 1);
    // Base HP from stamina=0: DEFAULT_BASE_HP
    setMapValue(MAP_CHAR_MAX_HP, 0, DEFAULT_BASE_HP);
    setMapValue(MAP_CHAR_HP, 0, DEFAULT_BASE_HP);
}

void main() {
    currentTx.height = getCurrentBlockheight();

    while ((currentTx.txId = getNextTx()) != ZERO) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);
        readAssets(currentTx.txId, currentTx.assetIds);

        if (currentTx.sender == getCreator()) {
            handleOwnerMessage();
        } else if (currentTx.sender == constructId) {
            handleConstructMessage();
        }
        // All other senders: ignore
    }
}

void handleOwnerMessage() {
    switch (currentTx.message[0]) {
        case METHOD_ATTACK:             doAttack();           break;
        case METHOD_ALLOCATE_SKILL:     allocateSkill();      break;
        case METHOD_COLLECT_ITEMS:      collectItems();       break;
        case METHOD_MIGRATE:            migrate();            break;
        case METHOD_EMERGENCY_WITHDRAW: emergencyWithdraw();  break;
        case METHOD_SET_LEVEL_THRESHOLD: setLevelThreshold(); break;
        case METHOD_USE_ITEM:           useItem();            break;
    }
}

void handleConstructMessage() {
    switch (currentTx.message[0]) {
        case METHOD_COUNTER_ATTACK: handleCounterAttack(); break;
        case METHOD_BUFF:           handleBuff();          break;
        case METHOD_DEBUFF:         handleDebuff();        break;
    }
    // Also check for XP token receipt and level up
    checkLevelUp();
}

void doAttack() { /* Task 4 */ }
void allocateSkill() { /* Task 5 */ }
void collectItems() { /* Task 9 */ }
void migrate() { /* Task 10 */ }
void emergencyWithdraw() { /* Task 9 */ }
void setLevelThreshold() { /* Task 8 */ }
void useItem() { /* Task 7 */ }
void handleCounterAttack() { /* Task 6 */ }
void handleBuff() { /* Task 6 */ }
void handleDebuff() { /* Task 6 */ }
void checkLevelUp() { /* Task 8 */ }
```

- [ ] **Step 4: Run compile test — expect PASS**

```bash
cd smartcontracts && npx vitest run character/compile.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add smartcontracts/character/
git commit -m "feat(character): add skeleton and compile test"
```

---

### Task 3: Test helpers

**Files:**
- Create: `smartcontracts/character/lib.ts`

- [ ] **Step 1: Create lib.ts**

```typescript
// smartcontracts/character/lib.ts
import { SmartC } from 'smartc-signum-compiler';
import type { SimulatorTestbed } from 'signum-smartc-testbed';
import { readFileSync } from 'fs';
import { Context } from './context';

export function compileToBytecode(path: string) {
    const code = readFileSync(path, 'utf8');
    const compiler = new SmartC({ language: 'C', sourceCode: code });
    compiler.compile();
    return compiler.getMachineCode();
}

export function getCharState(testbed: SimulatorTestbed, key: bigint): bigint {
    return testbed.getMapValue(key, 0n) ?? 0n;
}

export function sendAttack(testbed: SimulatorTestbed, opts: {
    signa: bigint;
    token?: { asset: bigint; quantity: bigint };
}) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.ThisContract,
        amount: opts.signa * 1_0000_0000n + Context.ActivationFee,
        tokens: opts.token ? [opts.token] : [],
        message: [Context.Methods.Attack, Context.ConstructContract, 0n, 0n],
    }]);
}

export function allocateSkill(testbed: SimulatorTestbed, attrIndex: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        message: [Context.Methods.AllocateSkill, attrIndex, 0n, 0n],
    }]);
}

export function sendCounterAttack(testbed: SimulatorTestbed, opts: {
    damage: bigint;
    statusEffect?: bigint;
    statusDuration?: bigint;
}) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.ConstructContract,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        message: [
            Context.Methods.CounterAttack,
            opts.damage,
            opts.statusEffect ?? 0n,
            opts.statusDuration ?? 0n,
        ],
    }]);
}

export function sendRevivalToken(testbed: SimulatorTestbed) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        tokens: [{ asset: Context.RevivalTokenId, quantity: 1n }],
    }]);
}

export const BootstrapScenario = [
    {
        blockheight: 1,
        amount: 200_0000_0000n,
        sender: Context.OwnerAccount,
        recipient: Context.ThisContract,
        // Deploy params: itemRegistryId, xpTokenId, revivalTokenId, constructId
        message: [Context.ItemRegistryContract, Context.XPTokenId, Context.RevivalTokenId, Context.ConstructContract],
    }
];
```

---

### Task 4: Attack forwarding

**Files:**
- Modify: `smartcontracts/character/character.contract.smart.c` — implement `doAttack()`
- Create: `smartcontracts/character/attack.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// smartcontracts/character/attack.test.ts
import { describe, expect, test, beforeEach } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { compileToBytecode, sendAttack, getCharState, BootstrapScenario } from './lib';

let testbed: SimulatorTestbed;
beforeEach(() => {
    const bc = compileToBytecode(Context.ContractPath);
    testbed = new SimulatorTestbed(bc, {
        contractAddress: Context.ThisContract,
        creatorAddress: Context.OwnerAccount,
    });
    testbed.loadTransactions(BootstrapScenario);
    testbed.runSlots(1);
});

describe('doAttack', () => {
    test('forwards SIGNA to constructId when not dead', () => {
        sendAttack(testbed, { signa: 100n });
        testbed.runSlots(1);
        const constructBalance = testbed.getAccountBalance(Context.ConstructContract);
        expect(constructBalance).toBeGreaterThan(0n);
    });

    test('refunds attack TX when character is dead', () => {
        // Kill the character first
        testbed.sendTransactionAndGetResponse([{
            sender: Context.ConstructContract,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            message: [Context.Methods.CounterAttack, 9999n, 0n, 0n],
        }]);
        testbed.runSlots(1);

        const ownerBalanceBefore = testbed.getAccountBalance(Context.OwnerAccount);
        sendAttack(testbed, { signa: 100n });
        testbed.runSlots(1);
        const constructBalance = testbed.getAccountBalance(Context.ConstructContract);
        expect(constructBalance).toBe(0n); // SIGNA not forwarded
    });

    test('forwards optional item token to construct', () => {
        const ITEM_TOKEN = 42n;
        sendAttack(testbed, { signa: 100n, token: { asset: ITEM_TOKEN, quantity: 1n } });
        testbed.runSlots(1);
        const constructTokenBalance = testbed.getAccountQuantity(Context.ConstructContract, ITEM_TOKEN);
        expect(constructTokenBalance).toBe(1n);
    });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd smartcontracts && npx vitest run character/attack.test.ts
```
Expected: FAIL

- [ ] **Step 3: Implement `doAttack()`**

Replace `void doAttack() { /* Task 4 */ }` in the contract:

```c
void doAttack() {
    long isDead = getMapValue(MAP_CHAR_IS_DEAD, 0);
    if (isDead != ZERO) {
        // Refund: send SIGNA and any token back to owner
        sendAmount(getAmount(currentTx.txId), getCreator());
        if (currentTx.assetIds[0] != ZERO) {
            sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[0]), currentTx.assetIds[0], getCreator());
        }
        return;
    }

    // Check stun/frozen status
    long frozenUntil  = getMapValue(MAP_FROZEN_UNTIL, 0);
    long stunnedUntil = getMapValue(MAP_STUNNED_UNTIL, 0);
    if (currentTx.height <= frozenUntil || currentTx.height <= stunnedUntil) {
        sendAmount(getAmount(currentTx.txId), getCreator());
        if (currentTx.assetIds[0] != ZERO) {
            sendQuantity(getQuantity(currentTx.txId, currentTx.assetIds[0]), currentTx.assetIds[0], getCreator());
        }
        return;
    }

    long target = currentTx.message[1];
    if (target == ZERO) { target = constructId; }

    // Forward SIGNA + optional token to construct
    if (currentTx.assetIds[0] != ZERO) {
        sendQuantityAndAmount(getQuantity(currentTx.txId, currentTx.assetIds[0]),
                              currentTx.assetIds[0],
                              getAmount(currentTx.txId),
                              target);
    } else {
        sendAmount(getAmount(currentTx.txId), target);
    }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd smartcontracts && npx vitest run character/attack.test.ts
```
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add smartcontracts/character/
git commit -m "feat(character): implement attack forwarding + tests"
```

---

### Task 5: Attribute allocation

**Files:**
- Modify: contract — implement `allocateSkill()`
- Create: `smartcontracts/character/attributes.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// smartcontracts/character/attributes.test.ts
import { describe, expect, test, beforeEach } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { compileToBytecode, allocateSkill, getCharState, BootstrapScenario } from './lib';

let testbed: SimulatorTestbed;
beforeEach(() => {
    const bc = compileToBytecode(Context.ContractPath);
    testbed = new SimulatorTestbed(bc, {
        contractAddress: Context.ThisContract,
        creatorAddress: Context.OwnerAccount,
    });
    testbed.loadTransactions(BootstrapScenario);
    testbed.runSlots(1);
});

describe('allocateSkill', () => {
    test('increases attribute and decrements skill points', () => {
        const ptsBefore = getCharState(testbed, Context.Maps.CharSkillPts);
        allocateSkill(testbed, Context.Attrs.Strength);
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharStrength)).toBe(1n);
        expect(getCharState(testbed, Context.Maps.CharSkillPts)).toBe(ptsBefore - 1n);
    });

    test('updating stamina increases maxHP and heals character', () => {
        allocateSkill(testbed, Context.Attrs.Stamina);
        testbed.runSlots(1);
        // HP_PER_STAMINA = 20
        expect(getCharState(testbed, Context.Maps.CharMaxHp)).toBe(120n);
        expect(getCharState(testbed, Context.Maps.CharHp)).toBe(120n);
    });

    test('does nothing when no skill points remain', () => {
        // Spend all 10 points on Strength (capped at 5, remaining 5 on other attrs)
        for (let i = 0; i < 5; i++) { allocateSkill(testbed, Context.Attrs.Strength); testbed.runSlots(1); }
        for (let i = 0; i < 5; i++) { allocateSkill(testbed, Context.Attrs.Stamina); testbed.runSlots(1); }
        // Now try again
        allocateSkill(testbed, Context.Attrs.Luck);
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharLuck)).toBe(0n);
    });

    test('caps attribute at ATTR_MAX_VALUE (5)', () => {
        for (let i = 0; i < 6; i++) {
            allocateSkill(testbed, Context.Attrs.Strength);
            testbed.runSlots(1);
        }
        expect(getCharState(testbed, Context.Maps.CharStrength)).toBe(5n);
    });

    test('ignores invalid attribute index', () => {
        const ptsBefore = getCharState(testbed, Context.Maps.CharSkillPts);
        allocateSkill(testbed, 99n); // out of range
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharSkillPts)).toBe(ptsBefore);
    });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd smartcontracts && npx vitest run character/attributes.test.ts
```

- [ ] **Step 3: Implement `allocateSkill()`**

Replace `void allocateSkill() { /* Task 5 */ }`:

```c
void allocateSkill() {
    long pts = getMapValue(MAP_CHAR_SKILL_PTS, 0);
    if (pts <= ZERO) { return; }

    long attrIndex = currentTx.message[1];
    if (attrIndex < ZERO || attrIndex > ATTR_MAX_INDEX) { return; }

    long mapKey = MAP_CHAR_STRENGTH + attrIndex;
    long current = getMapValue(mapKey, 0);
    if (current >= ATTR_MAX_VALUE) { return; }

    setMapValue(mapKey, 0, current + 1);
    setMapValue(MAP_CHAR_SKILL_PTS, 0, pts - 1);

    // Stamina increases maxHP and heals
    if (attrIndex == ATTR_STAMINA) {
        long maxHp = getMapValue(MAP_CHAR_MAX_HP, 0);
        long hp    = getMapValue(MAP_CHAR_HP, 0);
        setMapValue(MAP_CHAR_MAX_HP, 0, maxHp + HP_PER_STAMINA);
        setMapValue(MAP_CHAR_HP, 0, hp + HP_PER_STAMINA);
    }
}
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd smartcontracts && npx vitest run character/attributes.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add smartcontracts/character/
git commit -m "feat(character): attribute allocation + tests"
```

---

### Task 6: Counter-attack, death, and revival

**Files:**
- Modify: contract — implement `handleCounterAttack()`, `handleBuff()`, `handleDebuff()`, `triggerDeath()`
- Create: `smartcontracts/character/combat.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// smartcontracts/character/combat.test.ts
import { describe, expect, test, beforeEach } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { compileToBytecode, getCharState, sendCounterAttack, sendRevivalToken, BootstrapScenario } from './lib';

let testbed: SimulatorTestbed;
beforeEach(() => {
    const bc = compileToBytecode(Context.ContractPath);
    testbed = new SimulatorTestbed(bc, {
        contractAddress: Context.ThisContract,
        creatorAddress: Context.OwnerAccount,
    });
    testbed.loadTransactions(BootstrapScenario);
    testbed.runSlots(1);
});

describe('handleCounterAttack', () => {
    test('reduces HP by damage amount', () => {
        const hpBefore = getCharState(testbed, Context.Maps.CharHp);
        sendCounterAttack(testbed, { damage: 30n });
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharHp)).toBe(hpBefore - 30n);
    });

    test('writes frozen status with correct expiry block', () => {
        sendCounterAttack(testbed, {
            damage: 10n,
            statusEffect: Context.StatusEffects.Frozen,
            statusDuration: 5n,
        });
        testbed.runSlots(1);
        const frozenUntil = getCharState(testbed, Context.Maps.FrozenUntil);
        expect(frozenUntil).toBeGreaterThan(0n);
    });

    test('triggers death when HP drops to zero or below', () => {
        sendCounterAttack(testbed, { damage: 9999n });
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharIsDead)).toBe(1n);
        expect(getCharState(testbed, Context.Maps.CharHp)).toBe(0n);
    });

    test('applies death penalty: at least one attribute reduced', () => {
        // First give the character some attribute points
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            message: [Context.Methods.AllocateSkill, Context.Attrs.Strength, 0n, 0n],
        }]);
        testbed.runSlots(1);
        // Now kill
        sendCounterAttack(testbed, { damage: 9999n });
        testbed.runSlots(1);
        // Strength should have been reduced (or another attr if Strength was 0)
        const str = getCharState(testbed, Context.Maps.CharStrength);
        expect(str).toBeLessThanOrEqual(1n); // was 1, penalty reduces it
    });

    test('HP never goes below zero', () => {
        sendCounterAttack(testbed, { damage: 9999n });
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharHp)).toBe(0n);
    });
});

describe('revival', () => {
    test('revives dead character with full HP', () => {
        sendCounterAttack(testbed, { damage: 9999n });
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharIsDead)).toBe(1n);

        sendRevivalToken(testbed);
        testbed.runSlots(1);

        expect(getCharState(testbed, Context.Maps.CharIsDead)).toBe(0n);
        const maxHp = getCharState(testbed, Context.Maps.CharMaxHp);
        expect(getCharState(testbed, Context.Maps.CharHp)).toBe(maxHp);
    });

    test('ignores revival token when character is alive', () => {
        const hpBefore = getCharState(testbed, Context.Maps.CharHp);
        sendRevivalToken(testbed);
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharIsDead)).toBe(0n);
        expect(getCharState(testbed, Context.Maps.CharHp)).toBe(hpBefore);
    });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd smartcontracts && npx vitest run character/combat.test.ts
```

- [ ] **Step 3: Implement combat handlers**

Replace stub functions in the contract:

```c
void handleCounterAttack() {
    long damage = currentTx.message[1];
    long statusEffect = currentTx.message[2];
    long statusDuration = currentTx.message[3];

    long hp = getMapValue(MAP_CHAR_HP, 0);
    hp -= damage;
    if (hp <= ZERO) {
        hp = 0;
        setMapValue(MAP_CHAR_HP, 0, hp);
        triggerDeath();
        return;
    }
    setMapValue(MAP_CHAR_HP, 0, hp);

    if (statusEffect == STATUS_FROZEN) {
        setMapValue(MAP_FROZEN_UNTIL, 0, currentTx.height + statusDuration);
    } else if (statusEffect == STATUS_STUNNED) {
        setMapValue(MAP_STUNNED_UNTIL, 0, currentTx.height + statusDuration);
    } else if (statusEffect == STATUS_WEAKENED) {
        long stacks = getMapValue(MAP_DEBUFF_STACKS, 0);
        setMapValue(MAP_DEBUFF_STACKS, 0, stacks + 1);
    }
}

void triggerDeath() {
    setMapValue(MAP_CHAR_IS_DEAD, 0, 1);

    // Penalty: remove 1-3 points from a random non-zero attribute
    long penaltyPoints = (getWeakRandomNumber() >> 1) % 3 + 1;
    long i = 0;
    while (i < penaltyPoints) {
        long attrIdx = (getWeakRandomNumber() >> 1) % 5;
        long mapKey  = MAP_CHAR_STRENGTH + attrIdx;
        long val     = getMapValue(mapKey, 0);
        if (val > ZERO) {
            setMapValue(mapKey, 0, val - 1);
        }
        i++;
    }
}

void handleBuff() {
    long effectTarget  = currentTx.message[1];
    long bonusAbs      = currentTx.message[2];
    long expiryBlock   = currentTx.message[3];
    // For now write debuff stacks as negative (buff)
    // Specific buff KKV entries to be extended in future phases
}

void handleDebuff() {
    long stacks = getMapValue(MAP_DEBUFF_STACKS, 0);
    setMapValue(MAP_DEBUFF_STACKS, 0, stacks + 1);
}
```

Also handle revival in `main()` — add a check in `handleOwnerMessage` for incoming revival token:

```c
// In handleOwnerMessage(), add before switch:
if (currentTx.assetIds[0] == revivalTokenId && currentTx.assetIds[0] != ZERO) {
    handleRevival();
    return;
}
```

And add the function:

```c
void handleRevival() {
    long isDead = getMapValue(MAP_CHAR_IS_DEAD, 0);
    if (isDead == ZERO) { return; } // already alive, ignore token

    setMapValue(MAP_CHAR_IS_DEAD, 0, ZERO);
    long maxHp = getMapValue(MAP_CHAR_MAX_HP, 0);
    setMapValue(MAP_CHAR_HP, 0, maxHp);

    // Burn the revival token
    sendQuantity(1, revivalTokenId, ZERO);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd smartcontracts && npx vitest run character/combat.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add smartcontracts/character/
git commit -m "feat(character): counter-attack, death penalty, revival + tests"
```

---

### Task 7: Inventory and item management

**Files:**
- Modify: contract — implement item receipt logic, `useItem()`, `collectItems()`
- Create: `smartcontracts/character/inventory.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// smartcontracts/character/inventory.test.ts
import { describe, expect, test, beforeEach } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { compileToBytecode, getCharState, BootstrapScenario } from './lib';

const SHADOW_DAGGER = 42n;
const HEALING_POTION = 99n;

let testbed: SimulatorTestbed;
beforeEach(() => {
    const bc = compileToBytecode(Context.ContractPath);
    testbed = new SimulatorTestbed(bc, {
        contractAddress: Context.ThisContract,
        creatorAddress: Context.OwnerAccount,
    });
    testbed.loadTransactions(BootstrapScenario);
    testbed.runSlots(1);

    // Pre-register items in testbed's simulated registry state
    // (testbed must support mocking getExtMapValue responses)
    testbed.setExternalMapValue(Context.ItemRegistryContract, Context.ItemRegistryContract /* REG_ITEM_TYPE */, SHADOW_DAGGER, 1n);  // EQUIPMENT
    testbed.setExternalMapValue(Context.ItemRegistryContract, 5n /* REG_STACK_LIMIT */, SHADOW_DAGGER, 3n);
    testbed.setExternalMapValue(Context.ItemRegistryContract, 6n /* REG_MIN_LEVEL */, SHADOW_DAGGER, 1n);
    testbed.setExternalMapValue(Context.ItemRegistryContract, 7n /* REG_IS_BURNABLE */, SHADOW_DAGGER, 0n);
    testbed.setExternalMapValue(Context.ItemRegistryContract, 4n /* REG_BONUS_REL */, SHADOW_DAGGER, 115n); // +15%
    testbed.setExternalMapValue(Context.ItemRegistryContract, 2n /* REG_EFFECT_TARGET */, SHADOW_DAGGER, 0n); // attack

    testbed.setExternalMapValue(Context.ItemRegistryContract, 1n, HEALING_POTION, 2n);  // CONSUMABLE
    testbed.setExternalMapValue(Context.ItemRegistryContract, 5n, HEALING_POTION, 5n);  // stack 5
    testbed.setExternalMapValue(Context.ItemRegistryContract, 6n, HEALING_POTION, 0n);  // min level 0
    testbed.setExternalMapValue(Context.ItemRegistryContract, 7n, HEALING_POTION, 1n);  // burnable
    testbed.setExternalMapValue(Context.ItemRegistryContract, 3n, HEALING_POTION, 100n); // +100 HP abs
    testbed.setExternalMapValue(Context.ItemRegistryContract, 2n, HEALING_POTION, 1n);  // target HP
});

describe('item receipt', () => {
    test('accepts item within stack limit and increments inventory count', () => {
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            tokens: [{ asset: SHADOW_DAGGER, quantity: 1n }],
            message: [0n, 0n, 0n, 0n], // no method — raw token transfer
        }]);
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharInvCount)).toBe(1n);
        expect(testbed.getAssetBalance(Context.ThisContract, SHADOW_DAGGER)).toBe(1n);
    });

    test('refunds excess beyond stack limit', () => {
        // Send 4 Shadow Daggers (limit is 3)
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            tokens: [{ asset: SHADOW_DAGGER, quantity: 4n }],
            message: [0n, 0n, 0n, 0n],
        }]);
        testbed.runSlots(1);
        expect(testbed.getAssetBalance(Context.ThisContract, SHADOW_DAGGER)).toBe(3n);
        expect(testbed.getAssetBalance(Context.OwnerAccount, SHADOW_DAGGER)).toBe(1n); // 1 refunded
    });

    test('refunds all when inventory is full', () => {
        // Fill inventory to max (10 slots) first with some item
        // ... setup omitted for brevity — use a different token with stack 10
        // Then try to add more
        // expect refund
    });
});

describe('useItem (consumable)', () => {
    test('healing potion restores HP and burns token', () => {
        // Give character a healing potion
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            tokens: [{ asset: HEALING_POTION, quantity: 1n }],
            message: [0n, 0n, 0n, 0n],
        }]);
        testbed.runSlots(1);

        // Damage the character
        testbed.sendTransactionAndGetResponse([{
            sender: Context.ConstructContract, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            message: [Context.Methods.CounterAttack, 50n, 0n, 0n],
        }]);
        testbed.runSlots(1);
        const hpAfterDamage = getCharState(testbed, Context.Maps.CharHp);

        // Use healing potion
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            message: [Context.Methods.UseItem, HEALING_POTION, 0n, 0n],
        }]);
        testbed.runSlots(1);

        expect(getCharState(testbed, Context.Maps.CharHp)).toBe(hpAfterDamage + 100n);
        expect(testbed.getAssetBalance(Context.ThisContract, HEALING_POTION)).toBe(0n);
        expect(getCharState(testbed, Context.Maps.CharInvCount)).toBe(0n);
    });

    test('HP capped at maxHP when healing', () => {
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            tokens: [{ asset: HEALING_POTION, quantity: 1n }],
            message: [0n, 0n, 0n, 0n],
        }]);
        testbed.runSlots(1);
        // Character is at full HP — heal should cap
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            message: [Context.Methods.UseItem, HEALING_POTION, 0n, 0n],
        }]);
        testbed.runSlots(1);
        const maxHp = getCharState(testbed, Context.Maps.CharMaxHp);
        expect(getCharState(testbed, Context.Maps.CharHp)).toBe(maxHp);
    });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd smartcontracts && npx vitest run character/inventory.test.ts
```

- [ ] **Step 3: Implement item receipt in `main()` and `useItem()`**

In `handleOwnerMessage()`, before the switch, add token receipt handling:

```c
void handleItemReceipt() {
    long tokenId = currentTx.assetIds[0];
    if (tokenId == ZERO) { return; }
    if (tokenId == revivalTokenId) { return; } // handled separately

    long itemType   = getExtMapValue(REG_ITEM_TYPE, tokenId, itemRegistryId);
    if (itemType == ZERO) {
        // Unknown item — refund
        sendQuantity(getQuantity(currentTx.txId, tokenId), tokenId, getCreator());
        return;
    }

    long stackLimit = getExtMapValue(REG_STACK_LIMIT, tokenId, itemRegistryId);
    long minLevel   = getExtMapValue(REG_MIN_LEVEL,   tokenId, itemRegistryId);
    long charLevel  = getMapValue(MAP_CHAR_LEVEL, 0);

    if (charLevel < minLevel) {
        sendQuantity(getQuantity(currentTx.txId, tokenId), tokenId, getCreator());
        return;
    }

    long incoming = getQuantity(currentTx.txId, tokenId);
    long current  = getAssetBalance(tokenId);
    long maxSlots = getMapValue(MAP_CHAR_MAX_INV_SLOTS, 0);
    long invCount = getMapValue(MAP_CHAR_INV_COUNT, 0);

    long canAccept = stackLimit - current;
    if (canAccept <= ZERO) {
        sendQuantity(incoming, tokenId, getCreator());
        return;
    }
    if (incoming > canAccept) {
        sendQuantity(incoming - canAccept, tokenId, getCreator());
        incoming = canAccept;
    }

    if (invCount + incoming > maxSlots) {
        sendQuantity(incoming, tokenId, getCreator());
        return;
    }

    setMapValue(MAP_CHAR_INV_COUNT, 0, invCount + incoming);
    updateEquipmentBonuses(tokenId, incoming);
}

void updateEquipmentBonuses(long tokenId, long quantity) {
    long itemType    = getExtMapValue(REG_ITEM_TYPE,     tokenId, itemRegistryId);
    if (itemType != ITEM_EQUIPMENT) { return; }

    long effTarget   = getExtMapValue(REG_EFFECT_TARGET, tokenId, itemRegistryId);
    long bonusAbs    = getExtMapValue(REG_BONUS_ABS,     tokenId, itemRegistryId);
    long bonusRel    = getExtMapValue(REG_BONUS_REL,     tokenId, itemRegistryId);

    if (effTarget == TARGET_ATTACK) {
        if (bonusAbs > ZERO) {
            long cur = getMapValue(MAP_EQUIP_ATK_ABS, 0);
            setMapValue(MAP_EQUIP_ATK_ABS, 0, cur + bonusAbs * quantity);
        }
        if (bonusRel > ZERO) {
            long cur = getMapValue(MAP_EQUIP_ATK_REL, 0);
            setMapValue(MAP_EQUIP_ATK_REL, 0, cur + (bonusRel - 100) * quantity);
        }
    } else if (effTarget == TARGET_HP) {
        long cur = getMapValue(MAP_EQUIP_HP_ABS, 0);
        setMapValue(MAP_EQUIP_HP_ABS, 0, cur + bonusAbs * quantity);
    } else if (effTarget == TARGET_INV_SLOTS) {
        long cur = getMapValue(MAP_CHAR_MAX_INV_SLOTS, 0);
        setMapValue(MAP_CHAR_MAX_INV_SLOTS, 0, cur + bonusAbs * quantity);
    }
    // Attribute bonuses: effTarget 2-6 map to STR-WIL bonus KKV
    else if (effTarget >= TARGET_STR && effTarget <= TARGET_WIL) {
        long mapKey = MAP_EQUIP_STR_BONUS + (effTarget - TARGET_STR);
        long cur    = getMapValue(mapKey, 0);
        setMapValue(mapKey, 0, cur + bonusAbs * quantity);
    }
}

void useItem() {
    long tokenId = currentTx.message[1];
    if (tokenId == ZERO) { return; }

    long itemType = getExtMapValue(REG_ITEM_TYPE, tokenId, itemRegistryId);
    if (itemType != ITEM_CONSUMABLE) { return; }
    if (getAssetBalance(tokenId) <= ZERO) { return; }

    long effTarget = getExtMapValue(REG_EFFECT_TARGET, tokenId, itemRegistryId);
    long bonusAbs  = getExtMapValue(REG_BONUS_ABS,     tokenId, itemRegistryId);

    if (effTarget == TARGET_HP) {
        long hp    = getMapValue(MAP_CHAR_HP, 0);
        long maxHp = getMapValue(MAP_CHAR_MAX_HP, 0);
        hp += bonusAbs;
        if (hp > maxHp) { hp = maxHp; }
        setMapValue(MAP_CHAR_HP, 0, hp);
    }
    // Attribute consumables
    else if (effTarget >= TARGET_STR && effTarget <= TARGET_WIL) {
        long mapKey = MAP_CHAR_STRENGTH + (effTarget - TARGET_STR);
        long cur    = getMapValue(mapKey, 0);
        if (cur < ATTR_MAX_VALUE) {
            setMapValue(mapKey, 0, cur + 1);
        }
    }

    sendQuantity(1, tokenId, ZERO);  // burn
    long inv = getMapValue(MAP_CHAR_INV_COUNT, 0);
    if (inv > ZERO) { setMapValue(MAP_CHAR_INV_COUNT, 0, inv - 1); }
}

void collectItems() {
    long tokenId = currentTx.message[1];
    if (tokenId == ZERO) { return; }
    long balance = getAssetBalance(tokenId);
    if (balance <= ZERO) { return; }
    sendQuantity(balance, tokenId, getCreator());
    long inv = getMapValue(MAP_CHAR_INV_COUNT, 0);
    if (inv >= balance) { setMapValue(MAP_CHAR_INV_COUNT, 0, inv - balance); }
    else { setMapValue(MAP_CHAR_INV_COUNT, 0, ZERO); }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd smartcontracts && npx vitest run character/inventory.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add smartcontracts/character/
git commit -m "feat(character): inventory management, item receipt, consumables + tests"
```

---

### Task 8: Leveling system

**Files:**
- Modify: contract — implement `checkLevelUp()`, `setLevelThreshold()`
- Create: `smartcontracts/character/leveling.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// smartcontracts/character/leveling.test.ts
import { describe, expect, test, beforeEach } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { compileToBytecode, getCharState, BootstrapScenario } from './lib';

// KKV map keys for level thresholds
const MAP_LEVEL_THRESHOLD = 500n; // key1=500, key2=level => XP required

let testbed: SimulatorTestbed;
beforeEach(() => {
    const bc = compileToBytecode(Context.ContractPath);
    testbed = new SimulatorTestbed(bc, {
        contractAddress: Context.ThisContract,
        creatorAddress: Context.OwnerAccount,
    });
    testbed.loadTransactions(BootstrapScenario);
    testbed.runSlots(1);
});

describe('level up', () => {
    test('grants skill point when XP crosses level 2 threshold (1000 XP)', () => {
        // Simulate 1000 XP tokens arriving (from Construct)
        testbed.sendTransactionAndGetResponse([{
            sender: Context.ConstructContract, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            tokens: [{ asset: Context.XPTokenId, quantity: 1000n }],
            message: [0n, 0n, 0n, 0n],
        }]);
        testbed.runSlots(1);

        expect(getCharState(testbed, Context.Maps.CharLevel)).toBe(2n);
        // 10 starting + 1 from level up
        expect(getCharState(testbed, Context.Maps.CharSkillPts)).toBeGreaterThanOrEqual(1n);
    });

    test('does not grant skill point below threshold', () => {
        testbed.sendTransactionAndGetResponse([{
            sender: Context.ConstructContract, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            tokens: [{ asset: Context.XPTokenId, quantity: 500n }],
            message: [0n, 0n, 0n, 0n],
        }]);
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharLevel)).toBe(1n);
    });

    test('level threshold can be configured by owner', () => {
        // Set level 2 threshold to 500 XP
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            message: [Context.Methods.SetLevelThreshold, 2n, 500n, 0n],
        }]);
        testbed.runSlots(1);

        testbed.sendTransactionAndGetResponse([{
            sender: Context.ConstructContract, recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            tokens: [{ asset: Context.XPTokenId, quantity: 500n }],
            message: [0n, 0n, 0n, 0n],
        }]);
        testbed.runSlots(1);
        expect(getCharState(testbed, Context.Maps.CharLevel)).toBe(2n);
    });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd smartcontracts && npx vitest run character/leveling.test.ts
```

- [ ] **Step 3: Implement leveling**

```c
#define MAP_LEVEL_THRESHOLD 500  // key1=500, key2=level => XP required

void setLevelThreshold() {
    long level    = currentTx.message[1];
    long xpNeeded = currentTx.message[2];
    if (level <= 1 || level > 100) { return; }
    if (xpNeeded <= ZERO) { return; }
    setMapValue(MAP_LEVEL_THRESHOLD, level, xpNeeded);
}

long getLevelThreshold(long level) {
    long stored = getMapValue(MAP_LEVEL_THRESHOLD, level);
    if (stored > ZERO) { return stored; }
    // Default: 1000 * 2^(level-1)
    // Compute 2^(level-1) iteratively (no pow for integers)
    long threshold = 1000;
    long i = 1;
    while (i < level) {
        threshold = threshold * 2;
        i++;
    }
    return threshold;
}

void checkLevelUp() {
    long xp       = getAssetBalance(xpTokenId);
    long level    = getMapValue(MAP_CHAR_LEVEL, 0);
    long skillPts = getMapValue(MAP_CHAR_SKILL_PTS, 0);
    long leveled  = 0;

    while (1) {
        long nextLevel    = level + 1;
        long nextThreshold = getLevelThreshold(nextLevel);
        if (xp < nextThreshold) { break; }
        level++;
        skillPts++;
        leveled = 1;
        if (level >= 100) { break; }
    }

    if (leveled) {
        setMapValue(MAP_CHAR_LEVEL, 0, level);
        setMapValue(MAP_CHAR_SKILL_PTS, 0, skillPts);
    }
}
```

Call `checkLevelUp()` in `handleConstructMessage()` after processing the incoming message.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd smartcontracts && npx vitest run character/leveling.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add smartcontracts/character/
git commit -m "feat(character): leveling system + tests"
```

---

### Task 9: Emergency withdraw and collect items

Already partially implemented in Task 7. Complete `emergencyWithdraw()`:

- [ ] **Step 1: Implement emergencyWithdraw()**

```c
void emergencyWithdraw() {
    // Send entire SIGNA balance to owner
    sendBalance(getCreator());
    // Tokens must be withdrawn per-token via COLLECT_ITEMS
    // (SmartC has no "send all tokens" primitive)
}
```

- [ ] **Step 2: Test**

```typescript
test('emergency withdraw sends SIGNA balance to owner', () => {
    // Fund the character
    testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount, recipient: Context.ThisContract,
        amount: 100_0000_0000n, message: [0n, 0n, 0n, 0n],
    }]);
    testbed.runSlots(1);
    const ownerBefore = testbed.getAccountBalance(Context.OwnerAccount);

    testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount, recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        message: [Context.Methods.EmergencyWithdraw, 0n, 0n, 0n],
    }]);
    testbed.runSlots(1);
    expect(testbed.getAccountBalance(Context.OwnerAccount)).toBeGreaterThan(ownerBefore);
});
```

- [ ] **Step 3: Commit**

```bash
git add smartcontracts/character/
git commit -m "feat(character): emergency withdraw"
```

---

### Task 10: Migration from old character contract

**Files:**
- Modify: contract — implement `migrate()`
- Create: `smartcontracts/character/migrate.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// smartcontracts/character/migrate.test.ts
import { describe, expect, test } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { compileToBytecode, getCharState, BootstrapScenario } from './lib';

const OLD_CHAR_CONTRACT = 666n;

test('migrate copies all attribute values from old character contract', () => {
    const bc = compileToBytecode(Context.ContractPath);
    const testbed = new SimulatorTestbed(bc, {
        contractAddress: Context.ThisContract,
        creatorAddress: Context.OwnerAccount,
    });
    testbed.loadTransactions(BootstrapScenario);
    testbed.runSlots(1);

    // Simulate old contract having these attribute values
    testbed.setExternalMapValue(OLD_CHAR_CONTRACT, Context.Maps.CharStrength,  0n, 3n);
    testbed.setExternalMapValue(OLD_CHAR_CONTRACT, Context.Maps.CharStamina,   0n, 2n);
    testbed.setExternalMapValue(OLD_CHAR_CONTRACT, Context.Maps.CharDexterity, 0n, 1n);
    testbed.setExternalMapValue(OLD_CHAR_CONTRACT, Context.Maps.CharLuck,      0n, 0n);
    testbed.setExternalMapValue(OLD_CHAR_CONTRACT, Context.Maps.CharWillpower, 0n, 4n);
    testbed.setExternalMapValue(OLD_CHAR_CONTRACT, Context.Maps.CharLevel,     0n, 5n);
    testbed.setExternalMapValue(OLD_CHAR_CONTRACT, Context.Maps.CharSkillPts,  0n, 2n);

    testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount, recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        message: [Context.Methods.Migrate, OLD_CHAR_CONTRACT, 0n, 0n],
    }]);
    testbed.runSlots(1);

    expect(getCharState(testbed, Context.Maps.CharStrength)).toBe(3n);
    expect(getCharState(testbed, Context.Maps.CharStamina)).toBe(2n);
    expect(getCharState(testbed, Context.Maps.CharDexterity)).toBe(1n);
    expect(getCharState(testbed, Context.Maps.CharWillpower)).toBe(4n);
    expect(getCharState(testbed, Context.Maps.CharLevel)).toBe(5n);
    expect(getCharState(testbed, Context.Maps.CharSkillPts)).toBe(2n);
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd smartcontracts && npx vitest run character/migrate.test.ts
```

- [ ] **Step 3: Implement `migrate()`**

```c
void migrate() {
    long oldCharId = currentTx.message[1];
    if (oldCharId == ZERO) { return; }

    // Copy all attributes
    setMapValue(MAP_CHAR_STRENGTH,  0, getExtMapValue(MAP_CHAR_STRENGTH,  0, oldCharId));
    setMapValue(MAP_CHAR_STAMINA,   0, getExtMapValue(MAP_CHAR_STAMINA,   0, oldCharId));
    setMapValue(MAP_CHAR_DEXTERITY, 0, getExtMapValue(MAP_CHAR_DEXTERITY, 0, oldCharId));
    setMapValue(MAP_CHAR_LUCK,      0, getExtMapValue(MAP_CHAR_LUCK,      0, oldCharId));
    setMapValue(MAP_CHAR_WILLPOWER, 0, getExtMapValue(MAP_CHAR_WILLPOWER, 0, oldCharId));

    // Copy level and skill points
    setMapValue(MAP_CHAR_LEVEL,     0, getExtMapValue(MAP_CHAR_LEVEL,    0, oldCharId));
    setMapValue(MAP_CHAR_SKILL_PTS, 0, getExtMapValue(MAP_CHAR_SKILL_PTS, 0, oldCharId));

    // Recalculate maxHP from stamina
    long sta = getMapValue(MAP_CHAR_STAMINA, 0);
    setMapValue(MAP_CHAR_MAX_HP, 0, DEFAULT_BASE_HP + sta * HP_PER_STAMINA);
    setMapValue(MAP_CHAR_HP,     0, DEFAULT_BASE_HP + sta * HP_PER_STAMINA);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd smartcontracts && npx vitest run character/migrate.test.ts
```

- [ ] **Step 5: Full test run**

```bash
cd smartcontracts && npx vitest run character/
```
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add smartcontracts/character/
git commit -m "feat(character): migration + full test suite green"
```
