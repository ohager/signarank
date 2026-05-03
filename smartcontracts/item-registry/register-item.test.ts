import { describe, expect, test } from 'vitest';
import { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';
import { registerItem, getItemProp, BootstrapScenario } from './lib';

function makeTestbed() {
    return new SimulatorTestbed(BootstrapScenario)
        .loadContract(Context.ContractPath)
        .runScenario();
}

describe('registerItem', () => {
    test('stores all properties for an equipment item', () => {
        const testbed = makeTestbed();
        const SHADOW_DAGGER_TOKEN = 42n;
        registerItem(testbed, {
            tokenId:      SHADOW_DAGGER_TOKEN,
            itemType:     Context.ItemTypes.Equipment,
            effectTarget: Context.Targets.Attack,
            stackLimit:   3n,
            minLevel:     1n,
            isBurnable:   0n,
            bonusAbs:     0n,
            bonusRel:     115n,
        });

        expect(getItemProp(testbed, Context.Props.ItemType,     SHADOW_DAGGER_TOKEN)).toBe(Context.ItemTypes.Equipment);
        expect(getItemProp(testbed, Context.Props.EffectTarget, SHADOW_DAGGER_TOKEN)).toBe(Context.Targets.Attack);
        expect(getItemProp(testbed, Context.Props.StackLimit,   SHADOW_DAGGER_TOKEN)).toBe(3n);
        expect(getItemProp(testbed, Context.Props.MinLevel,     SHADOW_DAGGER_TOKEN)).toBe(1n);
        expect(getItemProp(testbed, Context.Props.IsBurnable,   SHADOW_DAGGER_TOKEN)).toBe(0n);
        expect(getItemProp(testbed, Context.Props.BonusRel,     SHADOW_DAGGER_TOKEN)).toBe(115n);
    });

    test('stores all properties for a consumable item', () => {
        const testbed = makeTestbed();
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

        expect(getItemProp(testbed, Context.Props.ItemType,   HEALING_POTION_TOKEN)).toBe(Context.ItemTypes.Consumable);
        expect(getItemProp(testbed, Context.Props.BonusAbs,   HEALING_POTION_TOKEN)).toBe(100n);
        expect(getItemProp(testbed, Context.Props.IsBurnable, HEALING_POTION_TOKEN)).toBe(1n);
        expect(getItemProp(testbed, Context.Props.StackLimit, HEALING_POTION_TOKEN)).toBe(5n);
    });

    test('rejects registration from non-creator', () => {
        const testbed = makeTestbed();
        const TOKEN = 77n;
        testbed.sendTransactionAndGetResponse([{
            sender: 999n,
            recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            messageArr: [Context.Methods.RegisterItem, TOKEN, 1n, 0n],
        }]);

        expect(getItemProp(testbed, Context.Props.ItemType, TOKEN)).toBe(0n);
    });

    test('ignores registration with zero tokenId', () => {
        const testbed = makeTestbed();
        registerItem(testbed, {
            tokenId: 0n, itemType: 1n, effectTarget: 0n,
            stackLimit: 1n, minLevel: 0n, isBurnable: 0n,
            bonusAbs: 0n, bonusRel: 100n,
        });
        // must not throw
    });

    test('defaults stackLimit to 1 when provided as 0', () => {
        const testbed = makeTestbed();
        const TOKEN = 55n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: Context.ItemTypes.Equipment,
            effectTarget: Context.Targets.Attack, stackLimit: 0n,
            minLevel: 0n, isBurnable: 0n, bonusAbs: 10n, bonusRel: 0n,
        });
        expect(getItemProp(testbed, Context.Props.StackLimit, TOKEN)).toBe(1n);
    });
});

describe('unregisterItem', () => {
    test('clears all properties', () => {
        const testbed = makeTestbed();
        const TOKEN = 42n;
        registerItem(testbed, {
            tokenId: TOKEN, itemType: Context.ItemTypes.Equipment,
            effectTarget: Context.Targets.Attack, stackLimit: 3n,
            minLevel: 1n, isBurnable: 0n, bonusAbs: 0n, bonusRel: 115n,
        });

        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: 1_0000_0000n,
            messageArr: [Context.Methods.UnregisterItem, TOKEN, 0n, 0n],
        }]);

        expect(getItemProp(testbed, Context.Props.ItemType,   TOKEN)).toBe(0n);
        expect(getItemProp(testbed, Context.Props.BonusRel,   TOKEN)).toBe(0n);
        expect(getItemProp(testbed, Context.Props.StackLimit, TOKEN)).toBe(0n);
    });
});
