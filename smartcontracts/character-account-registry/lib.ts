import type { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from './context';

export const BootstrapScenario = [
    {
        blockheight: 1,
        amount: 200_0000_0000n,
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
    },
];

export function setCharacterHash(testbed: SimulatorTestbed, hash: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender:    Context.GamemasterAccount,
        recipient: Context.ThisContract,
        amount:    1_0000_0000n,
        messageArr: [Context.Methods.SetCharacterHash, hash, 0n, 0n],
    }]);
}

export function registerCharacter(testbed: SimulatorTestbed, characterAddress: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender:    characterAddress,
        recipient: Context.ThisContract,
        amount:    1_0000_0000n,
        messageArr: [Context.Methods.RegisterCharacter, 0n, 0n, 0n],
    }]);
}

export function getValue(testbed: SimulatorTestbed, k1: bigint, k2: bigint): bigint {
    return testbed.getContractMapValue(k1, k2);
}

