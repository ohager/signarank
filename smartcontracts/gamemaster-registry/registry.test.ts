import { describe, expect, test } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import {
    BootstrapScenario,
    effectK1,
    setConstructHash,
    setCharacterHash,
    setXpToken,
    setConstructorAccount,
    setCharRegistry,
    setNextCharacterHash,
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

    // Registry-as-config: identities (xp token, constructor account, char
    // registry) are sourced from here so a Character's codehash pins only the
    // registry address, leaving no per-Character config to tamper with.
    test('stores xp token id at (3, 0)', () => {
        const testbed = makeTestbed();
        setXpToken(testbed, 2001n);
        expect(getValue(testbed, Context.Globals.XpToken, 0n)).toBe(2001n);
    });

    test('stores constructor account at (4, 0)', () => {
        const testbed = makeTestbed();
        setConstructorAccount(testbed, 7777n);
        expect(getValue(testbed, Context.Globals.ConstructorAccount, 0n)).toBe(7777n);
    });

    test('stores char registry address at (5, 0)', () => {
        const testbed = makeTestbed();
        setCharRegistry(testbed, 122344543655n);
        expect(getValue(testbed, Context.Globals.CharRegistry, 0n)).toBe(122344543655n);
    });

    // Enables the Character's one-shot MIGRATE when non-zero (v2 codehash).
    test('stores next character hash at (6, 0)', () => {
        const testbed = makeTestbed();
        setNextCharacterHash(testbed, 0xDEAD_BEEFn);
        expect(getValue(testbed, Context.Globals.NextCharacterHash, 0n)).toBe(0xDEAD_BEEFn);
    });

    test('ignores identity setters from a non-creator sender', () => {
        const testbed = makeTestbed();
        testbed.sendTransactionAndGetResponse([{
            sender: 999999n,
            recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            messageArr: [Context.Methods.SetXpToken, 2001n, 0n, 0n],
        }]);
        expect(getValue(testbed, Context.Globals.XpToken, 0n)).toBe(0n);
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
        setItemEffect(testbed, LEHARIS, 0n, effectK1(1001n));
        setItemEffect(testbed, LEHARIS, 1n, effectK1(1002n));
        setItemEffect(testbed, LEHARIS, 2n, effectK1(1003n));
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 0n)).toBe(effectK1(1001n));
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 1n)).toBe(effectK1(1002n));
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 2n)).toBe(effectK1(1003n));
    });

    test('setItemEffect bumps EffectCount when slot >= current count', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        setItemEffect(testbed, LEHARIS, 0n, effectK1(1001n));
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectCount)).toBe(1n);
        setItemEffect(testbed, LEHARIS, 2n, effectK1(1003n));
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectCount)).toBe(3n);
    });

    test('setItemEffect does NOT decrement EffectCount when overwriting in-range slot', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 3n,
        });
        setItemEffect(testbed, LEHARIS, 1n, effectK1(9999n));
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectCount)).toBe(3n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 1n)).toBe(effectK1(9999n));
    });

    test('re-registerItem with smaller effectCount clears stale effect slots above new count', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 5n,
        });
        setItemEffect(testbed, LEHARIS, 0n, effectK1(1001n));
        setItemEffect(testbed, LEHARIS, 1n, effectK1(1002n));
        setItemEffect(testbed, LEHARIS, 2n, effectK1(1003n));
        setItemEffect(testbed, LEHARIS, 3n, effectK1(1004n));
        setItemEffect(testbed, LEHARIS, 4n, effectK1(1005n));

        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 2n,
        });

        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectCount)).toBe(2n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 0n)).toBe(effectK1(1001n));
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 1n)).toBe(effectK1(1002n));
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 2n)).toBe(0n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 3n)).toBe(0n);
        expect(getValue(testbed, LEHARIS, Context.ItemKeys.EffectBase + 4n)).toBe(0n);
    });

    test('unregisterItem clears type, stackLimit, minLevel, effectCount and all effect slots', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: LEHARIS, itemType: 1n, stackLimit: 3n, minLevel: 5n, effectCount: 2n,
        });
        setItemEffect(testbed, LEHARIS, 0n, effectK1(1001n));
        setItemEffect(testbed, LEHARIS, 1n, effectK1(1002n));

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

    test('setItemEffect rejects effectId outside the effect range (no dangling ref)', () => {
        const testbed = makeTestbed();
        const TOKEN = 1_999_999_999n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: 1n, stackLimit: 1n, minLevel: 0n, effectCount: 0n,
        });
        // 1234n is below MinEffectId (would land in the item/globals namespace).
        setItemEffect(testbed, TOKEN, 0n, 1234n);
        expect(getValue(testbed, TOKEN, Context.ItemKeys.EffectBase + 0n)).toBe(0n);
        expect(getValue(testbed, TOKEN, Context.ItemKeys.EffectCount)).toBe(0n);
        expect(getErrorCodes(testbed)).toContain(Context.Errors.EffectIdInvalid);
    });

    test('setItemEffect rejects an unregistered item (no phantom item)', () => {
        const testbed = makeTestbed();
        const TOKEN = 1_999_999_999n;
        // No registerItem — the token has no IK_TYPE.
        setItemEffect(testbed, TOKEN, 0n, effectK1(1001n));
        expect(getValue(testbed, TOKEN, Context.ItemKeys.EffectBase + 0n)).toBe(0n);
        expect(getValue(testbed, TOKEN, Context.ItemKeys.EffectCount)).toBe(0n);
        expect(getErrorCodes(testbed)).toContain(Context.Errors.ItemNotRegistered);
    });
});

describe('Namespace Separation (high-end packing)', () => {
    test('registerEffect rejects effectId below MinEffectId (would land in Globals range)', () => {
        const testbed = makeTestbed();
        // RegistryBase + 10 sits in the Globals range, below MinEffectId — writing
        // an effect there would corrupt reserved global rows, so the gate rejects it
        // (nothing written, error logged).
        const GLOBALS_RANGE_ID = Context.RegistryBase + 10n;
        registerEffect(testbed, {
            effectId: GLOBALS_RANGE_ID, target: 1n, mode: 1n,
            bonusAbs: 99n, bonusRel: 0n, duration: 0n,
        });
        expect(getValue(testbed, GLOBALS_RANGE_ID, Context.EffectKeys.Mode)).toBe(0n);
        expect(getErrorCodes(testbed)).toContain(Context.Errors.EffectIdInvalid);
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

    test('setItemEffect rejects tokenId in registry range (would corrupt Globals)', () => {
        const testbed = makeTestbed();
        // A tokenId inside the registry range would write (RegistryBase+10,
        // IK_EFFECT_BASE + slot) over reserved global rows — the gate rejects it.
        const RANGE_ID = Context.RegistryBase + 10n;
        setItemEffect(testbed, RANGE_ID, 0n, 1234n);
        expect(getValue(testbed, RANGE_ID, Context.ItemKeys.EffectBase)).toBe(0n);
        expect(getErrorCodes(testbed)).toContain(Context.Errors.TokenIdInvalid);
    });

    test('unregisterItem rejects tokenId in registry range', () => {
        const testbed = makeTestbed();
        const RANGE_ID = Context.RegistryBase + 10n;
        unregisterItem(testbed, RANGE_ID);
        expect(getErrorCodes(testbed)).toContain(Context.Errors.TokenIdInvalid);
    });

    test('unregisterEffect rejects effectId outside effect range', () => {
        const testbed = makeTestbed();
        // Below MinEffectId — in the Globals range, which unregisterEffect must not touch.
        const RANGE_ID = Context.RegistryBase + 10n;
        unregisterEffect(testbed, RANGE_ID);
        expect(getErrorCodes(testbed)).toContain(Context.Errors.EffectIdInvalid);
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

