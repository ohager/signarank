import type {SimulatorTestbed, TransactionObj} from "signum-smartc-testbed";
import {Context} from "./context";

export function getCurrentHitpoints(testbed: SimulatorTestbed){
    const hpTokenId = testbed.getContractMemoryValue('hpTokenId');
    const hpToken = testbed.getContract().tokens.find(t => t.asset === hpTokenId);
    return hpToken?.quantity
}

export const DefaultRequiredInitializers = {
    name: "CT000001",
    xpTokenId: Context.XPTokenId,
    maxHp: 50_000n,
    breachLimit: 0n, // keep default
    coolDownInBlocks: 0n, // keep default
    firstBloodBonus: 0n,
    finalBlowBonus: 0n,
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
