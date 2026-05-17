import { describe, expect, test } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import {
    BootstrapScenario,
    effectK1,
    setConstructHash,
    setCharacterHash,
    setLevelThreshold,
    registerEffect,
    unregisterEffect,
    registerItem,
    unregisterItem,
    setItemEffect,
    getValue,
    getErrorCodes,
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
        const EID = effectK1(1001n);
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
        const EID = effectK1(5000n);
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
        const EID = effectK1(7777n);
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
        const EID = effectK1(2002n);
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

    test('re-registerItem with smaller effectCount clears stale effect slots above new count', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 5n,
        });
        setItemEffect(testbed, LEHARIS, 0n, 1001n);
        setItemEffect(testbed, LEHARIS, 1n, 1002n);
        setItemEffect(testbed, LEHARIS, 2n, 1003n);
        setItemEffect(testbed, LEHARIS, 3n, 1004n);
        setItemEffect(testbed, LEHARIS, 4n, 1005n);

        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 2n,
        });

        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectCount)).toBe(2n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 0n)).toBe(1001n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 1n)).toBe(1002n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 2n)).toBe(0n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 3n)).toBe(0n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 4n)).toBe(0n);
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
        const TOKEN = 1_234_567_890_123n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 99n,
            stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        expect(getValue(testbed, TOKEN, Context.ItemKeys.Type)).toBe(0n);
    });

    test('registerItem rejects effectCount > MAX_EFFECT_SLOTS_PER_ITEM', () => {
        const testbed = makeTestbed();
        const TOKEN = 1_234_567_890_124n;
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
        const EID = effectK1(4000n);
        registerEffect(testbed, {
            effectId: EID, target: 1n, mode: 0n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, EID, Context.EffectKeys.Target)).toBe(0n);
    });

    test('registerEffect rejects unknown mode (>5)', () => {
        const testbed = makeTestbed();
        const EID = effectK1(4001n);
        registerEffect(testbed, {
            effectId: EID, target: 1n, mode: 99n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, EID, Context.EffectKeys.Target)).toBe(0n);
    });

    test('setItemEffect rejects slot >= MAX_EFFECT_SLOTS_PER_ITEM', () => {
        const testbed = makeTestbed();
        const TOKEN = 1_999_999_999n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        setItemEffect(testbed, TOKEN, Context.MaxEffectSlotsPerItem, 1234n);
        expect(getValue(testbed, TOKEN, Context.ItemKeys.EffectBase + Context.MaxEffectSlotsPerItem)).toBe(0n);
        expect(getValue(testbed, TOKEN, Context.ItemKeys.EffectCount)).toBe(0n);
    });
});

describe('Namespace Separation (high-end packing)', () => {
    test('registerEffect rejects effectId below MinEffectId (would land in Globals range)', () => {
        const testbed = makeTestbed();
        setLevelThreshold(testbed, 1n, 500n);
        // RegistryBase + 10 is the physical k1 of LevelThreshold — sending it as effectId
        // would write (RegistryBase+10, EK_*) which collides with LevelThreshold rows
        // at k2 = 1..5. The gate must reject it.
        registerEffect(testbed, {
            effectId: Context.Globals.LevelThreshold, target: 1n, mode: 1n,
            bonusAbs: 99n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, Context.Globals.LevelThreshold, 1n)).toBe(500n);
    });

    test('registerEffect rejects effectId above MaxEffectId', () => {
        const testbed = makeTestbed();
        const EID = Context.MaxEffectId + 1n;
        registerEffect(testbed, {
            effectId: EID, target: 1n, mode: 1n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, EID, Context.EffectKeys.Mode)).toBe(0n);
    });

    test('registerEffect accepts boundary effectId = MinEffectId', () => {
        const testbed = makeTestbed();
        registerEffect(testbed, {
            effectId: Context.MinEffectId, target: 1n, mode: 1n,
            bonusAbs: 7n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, Context.MinEffectId, Context.EffectKeys.BonusAbs)).toBe(7n);
    });

    test('registerEffect accepts boundary effectId = MaxEffectId', () => {
        const testbed = makeTestbed();
        registerEffect(testbed, {
            effectId: Context.MaxEffectId, target: 1n, mode: 1n,
            bonusAbs: 11n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, Context.MaxEffectId, Context.EffectKeys.BonusAbs)).toBe(11n);
    });

    test('registerItem rejects tokenId at RegistryBase boundary', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: Context.RegistryBase, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        expect(getValue(testbed, Context.RegistryBase, Context.ItemKeys.Type)).toBe(0n);
    });

    test('registerItem rejects tokenId inside registry range', () => {
        const testbed = makeTestbed();
        const TOKEN = Context.RegistryBase + 50_000n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        expect(getValue(testbed, TOKEN, Context.ItemKeys.Type)).toBe(0n);
    });

    test('registerItem accepts tokenId just below RegistryBase', () => {
        const testbed = makeTestbed();
        const TOKEN = Context.RegistryBase - 1n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 1n, stackLimit: 2n, minLevel: 0n, effectCount: 0n,
        });
        expect(getValue(testbed, TOKEN, Context.ItemKeys.Type)).toBe(1n);
        expect(getValue(testbed, TOKEN, Context.ItemKeys.StackLimit)).toBe(2n);
    });

    test('registerItem accepts uint64 tokenId with bit 63 set (max uint64)', () => {
        const testbed = makeTestbed();
        // Off-chain convention: all IDs are unsigned uint64. Inside the contract this
        // appears as a negative signed long — the exact case our high-end gate must accept.
        const TOKEN = 0xFFFFFFFFFFFFFFFFn;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 1n, stackLimit: 9n, minLevel: 0n, effectCount: 0n,
        });
        expect(getValue(testbed, TOKEN, Context.ItemKeys.Type)).toBe(1n);
        expect(getValue(testbed, TOKEN, Context.ItemKeys.StackLimit)).toBe(9n);
    });

    test('registerItem accepts uint64 tokenId just past the sign boundary', () => {
        const testbed = makeTestbed();
        // 0x8000000000000001 — bit 63 set, signed-long interpretation = MIN_LONG + 1.
        const TOKEN = 0x8000000000000001n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 2n, stackLimit: 3n, minLevel: 0n, effectCount: 0n,
        });
        expect(getValue(testbed, TOKEN, Context.ItemKeys.Type)).toBe(2n);
    });

    test('setItemEffect rejects tokenId in registry range (would corrupt LevelThreshold)', () => {
        const testbed = makeTestbed();
        setLevelThreshold(testbed, 5n, 8000n);
        // Sending LevelThreshold's k1 as tokenId would write (RegistryBase+10, IK_EFFECT_BASE+0=10),
        // which is LevelThreshold for level 10.
        setItemEffect(testbed, Context.Globals.LevelThreshold, 0n, 1234n);
        expect(getValue(testbed, Context.Globals.LevelThreshold, 5n)).toBe(8000n);
        expect(getValue(testbed, Context.Globals.LevelThreshold, 10n)).toBe(0n);
    });

    test('unregisterItem rejects tokenId in registry range', () => {
        const testbed = makeTestbed();
        setLevelThreshold(testbed, 1n, 100n);
        setLevelThreshold(testbed, 2n, 300n);
        setLevelThreshold(testbed, 3n, 700n);
        unregisterItem(testbed, Context.Globals.LevelThreshold);
        expect(getValue(testbed, Context.Globals.LevelThreshold, 1n)).toBe(100n);
        expect(getValue(testbed, Context.Globals.LevelThreshold, 2n)).toBe(300n);
        expect(getValue(testbed, Context.Globals.LevelThreshold, 3n)).toBe(700n);
    });

    test('unregisterEffect rejects effectId outside effect range', () => {
        const testbed = makeTestbed();
        setLevelThreshold(testbed, 1n, 111n);
        setLevelThreshold(testbed, 5n, 555n);
        unregisterEffect(testbed, Context.Globals.LevelThreshold);
        expect(getValue(testbed, Context.Globals.LevelThreshold, 1n)).toBe(111n);
        expect(getValue(testbed, Context.Globals.LevelThreshold, 5n)).toBe(555n);
    });
});

describe('Error Logging', () => {
    test('successful tx does not write to error log', () => {
        const testbed = makeTestbed();
        registerEffect(testbed, {
            effectId: effectK1(1001n), target: 1n, mode: 1n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        expect(getErrorCodes(testbed)).toEqual([]);
    });

    test('logs ERR_EFFECT_ID_INVALID when effectId out of range', () => {
        const testbed = makeTestbed();
        registerEffect(testbed, {
            effectId: 42n, target: 1n, mode: 1n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        expect(getErrorCodes(testbed)).toEqual([Context.Errors.EffectIdInvalid]);
    });

    test('logs ERR_INVALID_MODE when mode out of range', () => {
        const testbed = makeTestbed();
        registerEffect(testbed, {
            effectId: effectK1(1001n), target: 1n, mode: 99n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        expect(getErrorCodes(testbed)).toEqual([Context.Errors.InvalidMode]);
    });

    test('logs ERR_TOKEN_ID_INVALID on registerItem with tokenId 0', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: 0n, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        expect(getErrorCodes(testbed)).toEqual([Context.Errors.TokenIdInvalid]);
    });

    test('logs ERR_TOKEN_ID_INVALID on registerItem in registry range', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: Context.RegistryBase, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        expect(getErrorCodes(testbed)).toEqual([Context.Errors.TokenIdInvalid]);
    });

    test('logs ERR_INVALID_ITEM_TYPE', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: 1_234_567_890n, itemType: 99n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        expect(getErrorCodes(testbed)).toEqual([Context.Errors.InvalidItemType]);
    });

    test('logs ERR_EFFECT_COUNT_INVALID', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: 1_234_567_890n, itemType: 1n, stackLimit: 1n, minLevel: 0n,
            effectCount: Context.MaxEffectSlotsPerItem + 1n,
        });
        expect(getErrorCodes(testbed)).toEqual([Context.Errors.EffectCountInvalid]);
    });

    test('logs ERR_INVALID_SLOT on setItemEffect with out-of-range slot', () => {
        const testbed = makeTestbed();
        const TOKEN = 1_999_999_999n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        setItemEffect(testbed, TOKEN, Context.MaxEffectSlotsPerItem, 1234n);
        expect(getErrorCodes(testbed)).toEqual([Context.Errors.InvalidSlot]);
    });

    test('logs ERR_TOKEN_ID_INVALID on unregisterItem with bad tokenId', () => {
        const testbed = makeTestbed();
        unregisterItem(testbed, Context.RegistryBase);
        expect(getErrorCodes(testbed)).toEqual([Context.Errors.TokenIdInvalid]);
    });

    test('logs ERR_EFFECT_ID_INVALID on unregisterEffect with bad effectId', () => {
        const testbed = makeTestbed();
        unregisterEffect(testbed, 42n);
        expect(getErrorCodes(testbed)).toEqual([Context.Errors.EffectIdInvalid]);
    });

    test('accumulates multiple errors across txs', () => {
        const testbed = makeTestbed();
        registerEffect(testbed, {
            effectId: 1n, target: 1n, mode: 1n, bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        registerItem(testbed, {
            tokenId: 0n, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        registerEffect(testbed, {
            effectId: effectK1(1001n), target: 1n, mode: 0n,
            bonusAbs: 1n, bonusRel: 0n, duration: 0n,
        });
        const codes = getErrorCodes(testbed).sort();
        expect(codes).toEqual([
            Context.Errors.TokenIdInvalid,
            Context.Errors.EffectIdInvalid,
            Context.Errors.InvalidMode,
        ].sort());
    });

    test('non-creator tx does NOT write to error log (rejected pre-dispatch)', () => {
        const testbed = makeTestbed();
        testbed.sendTransactionAndGetResponse([{
            sender: 99999n,
            recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            messageArr: [Context.Methods.RegisterItem, 0n, 0n, 0n],
        }]);
        expect(getErrorCodes(testbed)).toEqual([]);
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

