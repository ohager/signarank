import { describe, expect, test } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import {
    BootstrapScenario,
    setConstructHash,
    setCharacterHash,
    setLevelThreshold,
    registerEffect,
    unregisterEffect,
    registerItem,
    unregisterItem,
    setItemEffect,
    getValue,
} from './lib';

function makeTestbed() {
    return new SimulatorTestbed(BootstrapScenario)
        .loadContract(Context.ContractPath)
        .runScenario();
}

describe('Global Settings', () => {
    test('stores construct hash at (1, 0)', () => {
        const testbed = makeTestbed();
        const HASH = 0x1234_5678_9ABCn;
        setConstructHash(testbed, HASH);
        expect(getValue(testbed, Context.Globals.ConstructHash, 0n)).toBe(HASH);
    });

    test('stores character hash at (2, 0)', () => {
        const testbed = makeTestbed();
        const HASH = 0xAABB_CCDD_EEFFn;
        setCharacterHash(testbed, HASH);
        expect(getValue(testbed, Context.Globals.CharacterHash, 0n)).toBe(HASH);
    });

    test('stores level threshold at (10, level)', () => {
        const testbed = makeTestbed();
        setLevelThreshold(testbed, 2n, 1000n);
        setLevelThreshold(testbed, 5n, 8000n);
        expect(getValue(testbed, Context.Globals.LevelThreshold, 2n)).toBe(1000n);
        expect(getValue(testbed, Context.Globals.LevelThreshold, 5n)).toBe(8000n);
    });
});

describe('Effects', () => {
    test('registerEffect stores all 5 properties at (effectId, k2)', () => {
        const testbed = makeTestbed();
        const EID = 1001n;
        registerEffect(testbed, {
            effectId: EID,
            target:   Context.Targets.Strength,
            mode:     Context.Modes.AggregateAbs,
            bonusAbs: 2n,
            bonusRel: 0n,
            duration: 0n,
        });
        expect(getValue(testbed, EID, Context.EffectKeys.Target)).toBe(Context.Targets.Strength);
        expect(getValue(testbed, EID, Context.EffectKeys.Mode)).toBe(Context.Modes.AggregateAbs);
        expect(getValue(testbed, EID, Context.EffectKeys.BonusAbs)).toBe(2n);
        expect(getValue(testbed, EID, Context.EffectKeys.BonusRel)).toBe(0n);
        expect(getValue(testbed, EID, Context.EffectKeys.Duration)).toBe(0n);
    });

    test('registerEffect with non-zero rel + duration', () => {
        const testbed = makeTestbed();
        const EID = 5000n;
        registerEffect(testbed, {
            effectId: EID,
            target:   Context.Targets.DamageTaken,
            mode:     Context.Modes.AggregateRel,
            bonusAbs: 0n,
            bonusRel: 10n,
            duration: 0n,
        });
        expect(getValue(testbed, EID, Context.EffectKeys.Target)).toBe(Context.Targets.DamageTaken);
        expect(getValue(testbed, EID, Context.EffectKeys.Mode)).toBe(Context.Modes.AggregateRel);
        expect(getValue(testbed, EID, Context.EffectKeys.BonusRel)).toBe(10n);
    });

    test('registerEffect for status effect with duration', () => {
        const testbed = makeTestbed();
        const EID = 7777n;
        registerEffect(testbed, {
            effectId: EID,
            target:   42n,
            mode:     Context.Modes.StatusEffect,
            bonusAbs: 0n,
            bonusRel: 0n,
            duration: 1234n,
        });
        expect(getValue(testbed, EID, Context.EffectKeys.Duration)).toBe(1234n);
        expect(getValue(testbed, EID, Context.EffectKeys.Target)).toBe(42n);
    });

    test('unregisterEffect clears all 5 properties', () => {
        const testbed = makeTestbed();
        const EID = 2002n;
        registerEffect(testbed, {
            effectId: EID, target: 4n, mode: 1n,
            bonusAbs: 1n, bonusRel: 2n, duration: 3n,
        });
        unregisterEffect(testbed, EID);
        expect(getValue(testbed, EID, Context.EffectKeys.Target)).toBe(0n);
        expect(getValue(testbed, EID, Context.EffectKeys.Mode)).toBe(0n);
        expect(getValue(testbed, EID, Context.EffectKeys.BonusAbs)).toBe(0n);
        expect(getValue(testbed, EID, Context.EffectKeys.BonusRel)).toBe(0n);
        expect(getValue(testbed, EID, Context.EffectKeys.Duration)).toBe(0n);
    });
});

describe('Items', () => {
    const LEHARIS = 0x1234_5678_9ABCn;

    test('registerItem stores type, stackLimit, minLevel, effectCount', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId:     LEHARIS,
            itemType:    Context.ItemTypes.Equipment,
            stackLimit:  1n,
            minLevel:    5n,
            effectCount: 3n,
        });
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.Type)).toBe(Context.ItemTypes.Equipment);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.StackLimit)).toBe(1n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.MinLevel)).toBe(5n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectCount)).toBe(3n);
    });

    test('registerItem for consumable', () => {
        const testbed = makeTestbed();
        const POTION = 999_888_777_666n;
        registerItem(testbed, {
            tokenId:     POTION,
            itemType:    Context.ItemTypes.Consumable,
            stackLimit:  5n,
            minLevel:    0n,
            effectCount: 1n,
        });
        expect(getValue(testbed, POTION, Context.ItemKeys.Type)).toBe(Context.ItemTypes.Consumable);
        expect(getValue(testbed, POTION, Context.ItemKeys.StackLimit)).toBe(5n);
    });

    test('setItemEffect stores effectId at (tokenId, EffectBase + slot)', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        setItemEffect(testbed, LEHARIS, 0n, 1001n);
        setItemEffect(testbed, LEHARIS, 1n, 1002n);
        setItemEffect(testbed, LEHARIS, 2n, 1003n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 0n)).toBe(1001n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 1n)).toBe(1002n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 2n)).toBe(1003n);
    });

    test('setItemEffect bumps EffectCount when slot >= current count', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        setItemEffect(testbed, LEHARIS, 0n, 1001n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectCount)).toBe(1n);
        setItemEffect(testbed, LEHARIS, 2n, 1003n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectCount)).toBe(3n);
    });

    test('setItemEffect does NOT decrement EffectCount when overwriting in-range slot', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 3n,
        });
        setItemEffect(testbed, LEHARIS, 1n, 9999n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectCount)).toBe(3n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 1n)).toBe(9999n);
    });

    test('unregisterItem clears type, stackLimit, minLevel, effectCount and all effect slots', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 3n, minLevel: 5n, effectCount: 2n,
        });
        setItemEffect(testbed, LEHARIS, 0n, 1001n);
        setItemEffect(testbed, LEHARIS, 1n, 1002n);

        unregisterItem(testbed, LEHARIS);

        expect(getValue(testbed, LEHARIS, Context.ItemKeys.Type)).toBe(0n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.StackLimit)).toBe(0n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.MinLevel)).toBe(0n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectCount)).toBe(0n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 0n)).toBe(0n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 1n)).toBe(0n);
    });
});

describe('Validation', () => {
    test('registerItem rejects tokenId == 0', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: 0n, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        // No write should have happened — checking absence is implicit; just verify no crash
        expect(getValue(testbed, 0n, Context.ItemKeys.Type)).toBe(0n);
    });

    test('registerItem rejects invalid item type', () => {
        const testbed = makeTestbed();
        const TOKEN = 12345n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 99n,
            stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        expect(getValue(testbed, TOKEN, Context.ItemKeys.Type)).toBe(0n);
    });

    test('registerItem rejects effectCount > MAX_EFFECT_SLOTS_PER_ITEM', () => {
        const testbed = makeTestbed();
        const TOKEN = 12346n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 1n,
            stackLimit: 1n, minLevel: 0n,
            effectCount: Context.MaxEffectSlotsPerItem + 1n,
        });
        expect(getValue(testbed, TOKEN, Context.ItemKeys.Type)).toBe(0n);
    });

    test('registerEffect rejects effectId == 0', () => {
        const testbed = makeTestbed();
        registerEffect(testbed, {
            effectId: 0n, target: 1n, mode: 1n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, 0n, Context.EffectKeys.Mode)).toBe(0n);
    });

    test('registerEffect rejects effectId > MaxEffectId', () => {
        const testbed = makeTestbed();
        const HUGE = Context.MaxEffectId + 1n;
        registerEffect(testbed, {
            effectId: HUGE, target: 1n, mode: 1n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, HUGE, Context.EffectKeys.Mode)).toBe(0n);
    });

    test('registerEffect rejects invalid mode (0)', () => {
        const testbed = makeTestbed();
        const EID = 4000n;
        registerEffect(testbed, {
            effectId: EID, target: 1n, mode: 0n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, EID, Context.EffectKeys.Target)).toBe(0n);
    });

    test('registerEffect rejects unknown mode (>5)', () => {
        const testbed = makeTestbed();
        const EID = 4001n;
        registerEffect(testbed, {
            effectId: EID, target: 1n, mode: 99n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, EID, Context.EffectKeys.Target)).toBe(0n);
    });

    test('setItemEffect rejects slot >= MAX_EFFECT_SLOTS_PER_ITEM', () => {
        const testbed = makeTestbed();
        const TOKEN = 99999n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        setItemEffect(testbed, TOKEN, Context.MaxEffectSlotsPerItem, 1234n);
        expect(getValue(testbed, TOKEN, Context.ItemKeys.EffectBase + Context.MaxEffectSlotsPerItem)).toBe(0n);
        expect(getValue(testbed, TOKEN, Context.ItemKeys.EffectCount)).toBe(0n);
    });
});

describe('Authorization', () => {
    function asNonCreator(testbed: SimulatorTestbed, msg: bigint[]) {
        return testbed.sendTransactionAndGetResponse([{
            sender: 99999n,
            recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            messageArr: msg,
        }]);
    }

    test('non-creator cannot SET_CONSTRUCT_HASH', () => {
        const testbed = makeTestbed();
        asNonCreator(testbed, [Context.Methods.SetConstructHash, 12345n, 0n, 0n]);
        expect(getValue(testbed, Context.Globals.ConstructHash, 0n)).toBe(0n);
    });

    test('non-creator cannot REGISTER_ITEM', () => {
        const testbed = makeTestbed();
        asNonCreator(testbed, [Context.Methods.RegisterItem, 5555n, 1n, 0n]);
        expect(getValue(testbed, 5555n, Context.ItemKeys.Type)).toBe(0n);
    });

    test('non-creator cannot REGISTER_EFFECT', () => {
        const testbed = makeTestbed();
        asNonCreator(testbed, [Context.Methods.RegisterEffect, 1234n, 1n, 0n]);
        expect(getValue(testbed, 1234n, Context.EffectKeys.Target)).toBe(0n);
    });
});

