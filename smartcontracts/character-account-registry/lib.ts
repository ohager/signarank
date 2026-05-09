import type { SimulatorTestbed } from 'signum-smartc-testbed';
import { readFileSync } from 'fs';
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

// Deploys a secondary contract on the same simulator so tests can obtain a
// real `codeHashId` for use as the trusted character hash. The currently-
// selected contract is restored on return. Bypasses the testbed's public API
// because `loadContract()` doesn't expose contractID, and we need distinct
// addresses for the registry under test and the fake character contracts.
type DeployedContract = {
    contract: bigint;
    creator: bigint;
    codeHashId: bigint;
};

export function deploySecondaryContract(
    testbed: SimulatorTestbed,
    codePath: string,
    creator: bigint,
    contractId: bigint,
): DeployedContract {
    const previous = testbed.getContract();
    const code = readFileSync(codePath, 'utf-8');
    const node = (testbed as unknown as {
        node: { loadSmartContract(src: string, creator: bigint, contractID: bigint): unknown };
    }).node;
    node.loadSmartContract(code, creator, contractId);
    const deployed = testbed.getContract();
    testbed.selectContract(previous.contract);
    return {
        contract: deployed.contract,
        creator: deployed.creator,
        codeHashId: deployed.codeHashId,
    };
}
