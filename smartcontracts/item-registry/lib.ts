import type { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';

export type ItemDefinition = {
    tokenId: bigint;
    itemType: bigint;
    effectTarget: bigint;
    stackLimit: bigint;
    minLevel: bigint;
    isBurnable: bigint;
    bonusAbs: bigint;
    bonusRel: bigint;
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
        messageArr: [m0, m1, m2, m3],
    }]);
}

export function getItemProp(testbed: SimulatorTestbed, prop: bigint, tokenId: bigint): bigint {
    return testbed.getContractMapValue(prop, tokenId);
}

export const BootstrapScenario = [
    {
        blockheight: 1,
        amount: 200_0000_0000n,
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
    }
];
