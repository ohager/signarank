import type {SimulatorTestbed, TransactionObj} from "signum-smartc-testbed";
import {Context} from "./context";
import {SmartC} from "smartc-signum-compiler";

export function compileToBytecode(code: string) {
    const compiler = new SmartC({
        language: "C",
        sourceCode: code,
    });
    compiler.compile();
    return compiler.getMachineCode();
}


export function getCurrentHitpoints(testbed: SimulatorTestbed) {
    const hpTokenId = testbed.getContractMemoryValue('hpTokenId');
    const hpToken = testbed.getContract().tokens.find(t => t.asset === hpTokenId);
    return hpToken?.quantity
}

type AttackParams = {
    testbed: SimulatorTestbed,
    signa: bigint,
    tokens?: Array<{ asset: bigint, quantity: bigint }>,
    sender?: bigint
}


export function attack({testbed, sender = Context.SenderAccount1, signa, tokens = []}: AttackParams) {

    if (tokens.length > 4) {
        throw new Error("Max 4 tokens allowed")
    }

    return testbed.sendTransactionAndGetResponse([{
        sender,
        recipient: Context.ThisContract,
        amount: (signa * 1_0000_0000n) + Context.ActivationFee,
        tokens
    }])
}

type TimelapseType = {
    testbed: SimulatorTestbed,
    blocks: bigint
}

export function timeLapse({testbed, blocks}: TimelapseType) {
    for (let i = 0; i < blocks; i++) {
        testbed.blockchain.forgeBlock()
    }
}


export const DefaultRequiredInitializers = {
    name: "CT000001",
    xpTokenId: Context.XPTokenId,
    maxHp: 50_000n,
    breachLimit: 0n, // keep default
    coolDownInBlocks: 0n, // keep default
    firstBloodBonus: 0n,
    finalBlowBonus: 0n,
    isActive: 0n,
    rewardNftId: 0n,
    eventListenerAccountId: 0n
}


export const BootstrapScenario: TransactionObj[] = [
    {
        blockheight: 1,
        amount: 200_0000_0000n, // charge
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        tokens: [
            {asset: Context.XPTokenId, quantity: 50_000n}
        ]
    }
]
