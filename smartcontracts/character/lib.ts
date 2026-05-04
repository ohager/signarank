import type { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';

export type CharInitializers = {
    itemRegistryId?: bigint;
    xpTokenId?: bigint;
    revivalTokenId?: bigint;
    constructId?: bigint;
};

export function defaultInitializers(overrides: CharInitializers = {}) {
    return {
        itemRegistryId:  overrides.itemRegistryId  ?? 0n,
        xpTokenId:       overrides.xpTokenId       ?? Context.XPTokenId,
        revivalTokenId:  overrides.revivalTokenId  ?? Context.RevivalTokenId,
        constructId:     overrides.constructId     ?? Context.ConstructContract,
    };
}

export function getCharState(testbed: SimulatorTestbed, varName: string, address?: bigint): bigint {
    return testbed.getContractMemoryValue(varName, address) ?? 0n;
}

export function sendAttack(testbed: SimulatorTestbed, opts: {
    signa: bigint;
    token?: { asset: bigint; quantity: bigint };
    targetConstruct?: bigint;
}) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: 0n,
        amount: opts.signa * 1_0000_0000n + Context.ActivationFee,
        tokens: opts.token ? [opts.token] : [],
        messageArr: [Context.Methods.Attack, opts.targetConstruct ?? Context.ConstructContract, 0n, 0n],
    }]);
}

export function allocateSkill(testbed: SimulatorTestbed, attrIndex: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: 0n,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.AllocateSkill, attrIndex, 0n, 0n],
    }]);
}

export function sendCounterAttack(testbed: SimulatorTestbed, opts: {
    damage: bigint;
    statusEffect?: bigint;
    statusDuration?: bigint;
}) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.ConstructContract,
        recipient: 0n,
        amount: Context.ActivationFee,
        messageArr: [
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
        recipient: 0n,
        amount: Context.ActivationFee,
        tokens: [{ asset: Context.RevivalTokenId, quantity: 1n }],
    }]);
}

export const BootstrapScenario = [
    {
        blockheight: 1,
        amount: 200_0000_0000n,
        sender: Context.OwnerAccount,
        recipient: Context.CharacterAddress,
    }
];
