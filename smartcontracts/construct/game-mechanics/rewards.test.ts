import {describe, expect, test} from "vitest";
import {SimulatorTestbed} from "signum-smartc-testbed";
import {attack, BootstrapScenario, DefaultRequiredInitializers, getCurrentHitpoints, timeLapse} from "../lib";
import {Context} from "../context";

describe("Defeat and Victory Rewards", () => {
    test("should handle defeat correctly", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, {
                ...DefaultRequiredInitializers,
                maxHp: 100n, // maximal 1000 SIGNA
                breachLimit: 100n,
                firstBloodBonus: 50_0000_0000n,
                finalBlowBonus: 100_0000_0000n,
            })
            .runScenario();

        // Attack to defeat
        attack({testbed, signa: 550n, sender: Context.SenderAccount1})
        timeLapse({testbed, blocks: 2n})
        attack({testbed, signa: 520n, sender: Context.SenderAccount2})

        // Check defeated flag
        const hitpoints =  getCurrentHitpoints(testbed);
        expect(hitpoints).toBe(0n);
        const isDefeated = testbed.getContractMemoryValue('isDefeated');
        expect(isDefeated).toBe(1n);

        // check messages - first blood, final blow and rewards for same account
        const transactions = testbed.getTransactions();
        const sentFirstBloodMsgToAttacker = transactions.some( tx => tx.recipient === Context.SenderAccount1 && tx.messageText?.startsWith("FIRST BLOOD"))
        const sentVictoryMsgToAttacker = transactions.some( tx => tx.recipient === Context.SenderAccount2 && tx.messageText?.startsWith("VICTORY"))
        const sentFirstBloodBonus = transactions.some( tx => tx.recipient === Context.SenderAccount1 && tx.amount === 50_0000_0000n);
        const sentFinalBlowBonus = transactions.some( tx => tx.recipient === Context.SenderAccount2 && tx.amount === 100_0000_0000n);
        const sentDistributionPayout = transactions.some( tx => tx.recipient === 0n && tx.type === 2 && tx.messageText?.startsWith("Indirect balance/token distributed"))
        const sentBurnAmount = transactions.some( tx => tx.recipient === 0n && tx.amount > 90_0000_0000n)
        const sentTreasuryAmount = transactions.some( tx => tx.recipient === Context.CreatorAccount && tx.messageText?.startsWith("DEFEATED") && tx.amount > 40_0000_0000n)
        expect(sentVictoryMsgToAttacker).toBeTruthy();
        expect(sentFirstBloodMsgToAttacker).toBeTruthy();
        expect(sentDistributionPayout).toBeTruthy();
        expect(sentBurnAmount).toBeTruthy();
        expect(sentFirstBloodBonus).toBeTruthy();
        expect(sentFinalBlowBonus).toBeTruthy();
        expect(sentTreasuryAmount).toBeTruthy();

        const firstBloodAccount = testbed.getContractMemoryValue('firstBloodAccount')
        expect(firstBloodAccount).toBe(Context.SenderAccount1)
        testbed.getAccount(Context.SenderAccount1)!.tokens.forEach(t => {
            expect(t.quantity).toBe(55n); // xp and hp
        })

        const finalBlowAccount = testbed.getContractMemoryValue('finalBlowAccount')
        expect(finalBlowAccount).toBe(Context.SenderAccount2)
        testbed.getAccount(Context.SenderAccount2)!.tokens.forEach(t => {
            expect(t.quantity).toBe(45n); // xp and hp
        })

    })
})
