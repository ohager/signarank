# Item Registry Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a global singleton Item Registry smart contract on Signum that lets the Gamemaster register item definitions (type, effect, stack limit, level requirement, burnability) which Character and Construct contracts read via `getExtMapValue`.

**Architecture:** Single SmartC contract storing item definitions in a KKV map (key1=property constant, key2=tokenId). Only the Creator can register or update items. No init-time assets issued. Mirrors the pattern of `construct.contract.smart.c`.

**Tech Stack:** SmartC C dialect, `signum-smartc-testbed`, `vitest`, TypeScript test helpers

---

## Reference

- Spec: `docs/superpowers/specs/2026-05-03-character-contract-design.md` → "Item Registry Contract" section
- Existing pattern: `smartcontracts/construct/construct.contract.smart.c`
- Test pattern: `smartcontracts/construct/compile.test.ts`, `context.ts`, `lib.ts`
- SmartC API: https://github.com/deleterium/SmartC/blob/main/docs/1.5-Built-in-functions.md

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `smartcontracts/item-registry/item-registry.contract.smart.c` | Create | The contract |
| `smartcontracts/item-registry/context.ts` | Create | Test constants (accounts, method codes, map keys) |
| `smartcontracts/item-registry/lib.ts` | Create | Test helpers (compile, register item, query item) |
| `smartcontracts/item-registry/compile.test.ts` | Create | Compilation size check |
| `smartcontracts/item-registry/register-item.test.ts` | Create | Registration logic tests |
| `smartcontracts/item-registry/query-item.test.ts` | Create | Cross-contract read verification |

---

### Task 1: Directory and context setup

**Files:**
- Create: `smartcontracts/item-registry/context.ts`

- [ ] **Step 1: Create context.ts**

```typescript
// smartcontracts/item-registry/context.ts
import { join } from 'path';

export const Context = {
    ContractPath: join(__dirname + '/item-registry.contract.smart.c'),
    CreatorAccount: 555n,
    GamemasterAccount: 555n,
    ThisContract: 888n,
    // Method codes (message[0])
    Methods: {
        RegisterItem:   1n,
        UnregisterItem: 2n,
    },
    // KKV property keys (key1) — must match contract #defines
    Props: {
        ItemType:     1n,
        EffectTarget: 2n,
        BonusAbs:     3n,
        BonusRel:     4n,
        StackLimit:   5n,
        MinLevel:     6n,
        IsBurnable:   7n,
    },
    // ItemType values
    ItemTypes: {
        Equipment:  1n,
        Consumable: 2n,
    },
    // EffectTarget values
    Targets: {
        Attack:    0n,
        HP:        1n,
        Strength:  2n,
        Stamina:   3n,
        Dexterity: 4n,
        Luck:      5n,
        Willpower: 6n,
        InvSlots:  7n,
    },
} as const;
```

- [ ] **Step 2: Verify directory**

```bash
ls smartcontracts/item-registry/
```
Expected: `context.ts`

---

### Task 2: Compilation test scaffold

**Files:**
- Create: `smartcontracts/item-registry/compile.test.ts`
- Create: `smartcontracts/item-registry/item-registry.contract.smart.c` (skeleton)

- [ ] **Step 1: Write failing compile test**

```typescript
// smartcontracts/item-registry/compile.test.ts
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'fs';
import { Context } from './context';
import { SmartC } from 'smartc-signum-compiler';

const MAX_CODE_SIZE = 40 * 256;

describe('Item Registry Compile Test', () => {
    test('should compile without errors and be within code size limit', () => {
        const code = readFileSync(Context.ContractPath, 'utf8');
        const compiler = new SmartC({ language: 'C', sourceCode: code });
        const compiled = compiler.compile();
        const machinedata = compiled.getMachineCode();
        expect(machinedata).toBeDefined();
        expect(machinedata.ByteCode.length / 2).toBeLessThanOrEqual(MAX_CODE_SIZE);
    });
});
```

- [ ] **Step 2: Run test — expect FAIL (file not found)**

```bash
cd smartcontracts && npx vitest run item-registry/compile.test.ts
```
Expected: FAIL — `ENOENT: no such file or directory`

- [ ] **Step 3: Create contract skeleton**

```c
// smartcontracts/item-registry/item-registry.contract.smart.c
#program name ItemReg
#program description Global Item Registry for Signarank Characters
#program activationAmount 100000000
#pragma optimizationLevel 2
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0

// Method codes
#define REGISTER_ITEM   1
#define UNREGISTER_ITEM 2

// KKV property keys (key1)
#define PROP_ITEM_TYPE      1
#define PROP_EFFECT_TARGET  2
#define PROP_BONUS_ABS      3
#define PROP_BONUS_REL      4
#define PROP_STACK_LIMIT    5
#define PROP_MIN_LEVEL      6
#define PROP_IS_BURNABLE    7

// Item type values
#define ITEM_EQUIPMENT  1
#define ITEM_CONSUMABLE 2

// Effect target values
#define TARGET_ATTACK    0
#define TARGET_HP        1
#define TARGET_STR       2
#define TARGET_STA       3
#define TARGET_DEX       4
#define TARGET_LCK       5
#define TARGET_WIL       6
#define TARGET_INV_SLOTS 7

long ZERO;
const ZERO = 0;

struct TX {
    long txId;
    long sender;
    long message[4];
} currentTx;

void main() {
    while ((currentTx.txId = getNextTx()) != ZERO) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);
        if (currentTx.sender == getCreator()) {
            switch (currentTx.message[0]) {
                case REGISTER_ITEM:
                    registerItem();
                break;
                case UNREGISTER_ITEM:
                    unregisterItem();
                break;
            }
        }
    }
}

void registerItem() {
    // message layout:
    // [0] = REGISTER_ITEM
    // [1] = tokenId
    // [2] = packed: itemType(8) | effectTarget(8) | stackLimit(8) | minLevel(8) | isBurnable(8)
    // [3] = packed: bonusAbs(32) | bonusRel(32)
    long tokenId    = currentTx.message[1];
    long packed1    = currentTx.message[2];
    long packed2    = currentTx.message[3];

    if (tokenId == ZERO) { return; }

    long itemType    = packed1 & 0xFF;
    long effTarget   = (packed1 >> 8) & 0xFF;
    long stackLimit  = (packed1 >> 16) & 0xFF;
    long minLevel    = (packed1 >> 24) & 0xFF;
    long isBurnable  = (packed1 >> 32) & 0xFF;
    long bonusAbs    = packed2 & 0xFFFFFFFF;
    long bonusRel    = (packed2 >> 32) & 0xFFFFFFFF;

    if (itemType != ITEM_EQUIPMENT && itemType != ITEM_CONSUMABLE) { return; }
    if (stackLimit <= ZERO) { stackLimit = 1; }

    setMapValue(PROP_ITEM_TYPE,     tokenId, itemType);
    setMapValue(PROP_EFFECT_TARGET, tokenId, effTarget);
    setMapValue(PROP_BONUS_ABS,     tokenId, bonusAbs);
    setMapValue(PROP_BONUS_REL,     tokenId, bonusRel);
    setMapValue(PROP_STACK_LIMIT,   tokenId, stackLimit);
    setMapValue(PROP_MIN_LEVEL,     tokenId, minLevel);
    setMapValue(PROP_IS_BURNABLE,   tokenId, isBurnable);
}

void unregisterItem() {
    long tokenId = currentTx.message[1];
    if (tokenId == ZERO) { return; }
    setMapValue(PROP_ITEM_TYPE,     tokenId, ZERO);
    setMapValue(PROP_EFFECT_TARGET, tokenId, ZERO);
    setMapValue(PROP_BONUS_ABS,     tokenId, ZERO);
    setMapValue(PROP_BONUS_REL,     tokenId, ZERO);
    setMapValue(PROP_STACK_LIMIT,   tokenId, ZERO);
    setMapValue(PROP_MIN_LEVEL,     tokenId, ZERO);
    setMapValue(PROP_IS_BURNABLE,   tokenId, ZERO);
}
```

- [ ] **Step 4: Run compile test — expect PASS**

```bash
cd smartcontracts && npx vitest run item-registry/compile.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add smartcontracts/item-registry/
git commit -m "feat(item-registry): add contract skeleton and compile test"
```

---

### Task 3: Test helpers

**Files:**
- Create: `smartcontracts/item-registry/lib.ts`

- [ ] **Step 1: Create lib.ts**

```typescript
// smartcontracts/item-registry/lib.ts
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

export type ItemDefinition = {
    tokenId: bigint;
    itemType: bigint;       // 1=equipment, 2=consumable
    effectTarget: bigint;   // 0=attack, 1=HP, 2=STR, ...
    stackLimit: bigint;     // max of this token in inventory
    minLevel: bigint;       // minimum character level
    isBurnable: bigint;     // 1=burned after use
    bonusAbs: bigint;       // absolute bonus value
    bonusRel: bigint;       // relative bonus (120=+20%, 90=-10%)
};

export function packRegisterItem(def: ItemDefinition): [bigint, bigint, bigint, bigint] {
    const packed1 =
        (def.itemType & 0xFFn) |
        ((def.effectTarget & 0xFFn) << 8n) |
        ((def.stackLimit & 0xFFn) << 16n) |
        ((def.minLevel & 0xFFn) << 24n) |
        ((def.isBurnable & 0xFFn) << 32n);

    const packed2 =
        (def.bonusAbs & 0xFFFFFFFFn) |
        ((def.bonusRel & 0xFFFFFFFFn) << 32n);

    return [Context.Methods.RegisterItem, def.tokenId, packed1, packed2];
}

export function registerItem(testbed: SimulatorTestbed, def: ItemDefinition) {
    const [m0, m1, m2, m3] = packRegisterItem(def);
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: 1_0000_0000n,
        message: [m0, m1, m2, m3],
    }]);
}

export function getItemProp(testbed: SimulatorTestbed, prop: bigint, tokenId: bigint): bigint {
    return testbed.getMapValue(prop, tokenId) ?? 0n;
}

export const BootstrapScenario = [
    {
        blockheight: 1,
        amount: 200_0000_0000n,
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
    }
];
```

- [ ] **Step 2: Run existing compile test — still PASS**

```bash
cd smartcontracts && npx vitest run item-registry/compile.test.ts
```
Expected: PASS

---

### Task 4: Registration tests

**Files:**
- Create: `smartcontracts/item-registry/register-item.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// smartcontracts/item-registry/register-item.test.ts
import { describe, expect, test, beforeEach } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { compileToBytecode, registerItem, getItemProp, BootstrapScenario } from './lib';

let testbed: SimulatorTestbed;

beforeEach(() => {
    const bytecode = compileToBytecode(Context.ContractPath);
    testbed = new SimulatorTestbed(bytecode, {
        contractAddress: Context.ThisContract,
        creatorAddress: Context.CreatorAccount,
    });
    testbed.loadTransactions(BootstrapScenario);
    testbed.runSlots(1);
});

describe('registerItem', () => {
    test('stores all properties for an equipment item', () => {
        const SHADOW_DAGGER_TOKEN = 42n;
        registerItem(testbed, {
            tokenId:      SHADOW_DAGGER_TOKEN,
            itemType:     Context.ItemTypes.Equipment,
            effectTarget: Context.Targets.Attack,
            stackLimit:   3n,
            minLevel:     1n,
            isBurnable:   0n,
            bonusAbs:     0n,
            bonusRel:     115n, // +15%
        });
        testbed.runSlots(1);

        expect(getItemProp(testbed, Context.Props.ItemType,     SHADOW_DAGGER_TOKEN)).toBe(Context.ItemTypes.Equipment);
        expect(getItemProp(testbed, Context.Props.EffectTarget, SHADOW_DAGGER_TOKEN)).toBe(Context.Targets.Attack);
        expect(getItemProp(testbed, Context.Props.StackLimit,   SHADOW_DAGGER_TOKEN)).toBe(3n);
        expect(getItemProp(testbed, Context.Props.MinLevel,     SHADOW_DAGGER_TOKEN)).toBe(1n);
        expect(getItemProp(testbed, Context.Props.IsBurnable,   SHADOW_DAGGER_TOKEN)).toBe(0n);
        expect(getItemProp(testbed, Context.Props.BonusRel,     SHADOW_DAGGER_TOKEN)).toBe(115n);
    });

    test('stores all properties for a consumable item', () => {
        const HEALING_POTION_TOKEN = 99n;
        registerItem(testbed, {
            tokenId:      HEALING_POTION_TOKEN,
            itemType:     Context.ItemTypes.Consumable,
            effectTarget: Context.Targets.HP,
            stackLimit:   5n,
            minLevel:     0n,
            isBurnable:   1n,
            bonusAbs:     100n,
            bonusRel:     0n,
        });
        testbed.runSlots(1);

        expect(getItemProp(testbed, Context.Props.ItemType,   HEALING_POTION_TOKEN)).toBe(Context.ItemTypes.Consumable);
        expect(getItemProp(testbed, Context.Props.BonusAbs,   HEALING_POTION_TOKEN)).toBe(100n);
        expect(getItemProp(testbed, Context.Props.IsBurnable, HEALING_POTION_TOKEN)).toBe(1n);
        expect(getItemProp(testbed, Context.Props.StackLimit, HEALING_POTION_TOKEN)).toBe(5n);
    });

    test('rejects registration from non-creator', () => {
        const TOKEN = 77n;
        testbed.sendTransactionAndGetResponse([{
            sender: 999n, // not creator
            recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            message: [Context.Methods.RegisterItem, TOKEN, 1n, 0n],
        }]);
        testbed.runSlots(1);

        expect(getItemProp(testbed, Context.Props.ItemType, TOKEN)).toBe(0n);
    });

    test('ignores registration with zero tokenId', () => {
        registerItem(testbed, {
            tokenId: 0n, itemType: 1n, effectTarget: 0n,
            stackLimit: 1n, minLevel: 0n, isBurnable: 0n,
            bonusAbs: 0n, bonusRel: 100n,
        });
        testbed.runSlots(1);
        // No assertion needed — just must not throw
    });

    test('defaults stackLimit to 1 when provided as 0', () => {
        const TOKEN = 55n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: Context.ItemTypes.Equipment,
            effectTarget: Context.Targets.Attack, stackLimit: 0n,
            minLevel: 0n, isBurnable: 0n, bonusAbs: 10n, bonusRel: 0n,
        });
        testbed.runSlots(1);
        expect(getItemProp(testbed, Context.Props.StackLimit, TOKEN)).toBe(1n);
    });
});

describe('unregisterItem', () => {
    test('clears all properties', () => {
        const TOKEN = 42n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: Context.ItemTypes.Equipment,
            effectTarget: Context.Targets.Attack, stackLimit: 3n,
            minLevel: 1n, isBurnable: 0n, bonusAbs: 0n, bonusRel: 115n,
        });
        testbed.runSlots(1);

        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            message: [Context.Methods.UnregisterItem, TOKEN, 0n, 0n],
        }]);
        testbed.runSlots(1);

        expect(getItemProp(testbed, Context.Props.ItemType,   TOKEN)).toBe(0n);
        expect(getItemProp(testbed, Context.Props.BonusRel,   TOKEN)).toBe(0n);
        expect(getItemProp(testbed, Context.Props.StackLimit, TOKEN)).toBe(0n);
    });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd smartcontracts && npx vitest run item-registry/register-item.test.ts
```
Expected: FAIL — testbed API mismatches or logic errors to be discovered

- [ ] **Step 3: Fix until green**

Run tests iteratively, fix contract or test helpers as needed.

```bash
cd smartcontracts && npx vitest run item-registry/register-item.test.ts
```
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add smartcontracts/item-registry/
git commit -m "feat(item-registry): register/unregister item logic + tests"
```

---

### Task 5: Update Construct context with Registry method codes

**Files:**
- Modify: `smartcontracts/construct/context.ts`

The Construct will eventually need to call `getExtMapValue` with the registry's property keys. Document them here for future use.

- [ ] **Step 1: Add registry constants to Construct context**

In `smartcontracts/construct/context.ts`, add after the existing `Maps` block:

```typescript
    // Item Registry property keys (shared with item-registry contract)
    ItemRegistryProps: {
        ItemType:     1n,
        EffectTarget: 2n,
        BonusAbs:     3n,
        BonusRel:     4n,
        StackLimit:   5n,
        MinLevel:     6n,
        IsBurnable:   7n,
    },
```

- [ ] **Step 2: Run existing Construct tests — still pass**

```bash
cd smartcontracts && npx vitest run construct/
```
Expected: all PASS (no logic changed)

- [ ] **Step 3: Commit**

```bash
git add smartcontracts/construct/context.ts
git commit -m "chore(construct): add item registry prop keys to context"
```
