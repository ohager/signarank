import {describe, expect, test} from "vitest";
import {attack, deployConstruct, getCurrentHitpoints, timeLapse} from "../lib";
import {Context} from "../context";

describe("Defeat and Victory Rewards", () => {
    test("should handle defeat correctly", async () => {
        const testbed = deployConstruct({
            maxHp: 100n, // maximal 1000 SIGNA
            breachLimit: 100n,
            firstBloodBonus: 50_0000_0000n,
            finalBlowBonus: 100_0000_0000n,
        });

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

// Regression for the Finding 1 fix. Two guarantees are exercised here:
//   1. A straggler that reaches the construct AFTER it is already defeated is
//      refunded, not kept (pre-fix it fell through and was swept into the payout).
//   2. The defeat distribution runs exactly once, guarded by `defeatHandled`.
// The straggler is queued in the SAME block as the final blow: once a construct
// burns its balance to 0 on defeat it can no longer re-activate, so a same-block
// straggler is the reproducible shape of this scenario. (The cross-activation
// re-run the `defeatHandled` flag also guards against relies on incoming funds
// re-activating a 0-balance AT, which the simulator does not model.)
describe("Post-defeat safety (handleDefeat is one-shot)", () => {
    const StragglerAccount = 30n; // refunded after the final blow, same block
    const StragglerSigna = 300n;

    test("a same-block straggler after the final blow is refunded, not kept", () => {
        const testbed = deployConstruct({
            maxHp: 100n,
            breachLimit: 100n,
            firstBloodBonus: 50_0000_0000n,
            finalBlowBonus: 100_0000_0000n,
        });

        // One block, three queued attackers. SenderAccount1 lands the final blow
        // (1100 SIGNA → damage capped to the full 100 HP); the two stragglers are
        // then processed with isDefeated already set and must be refunded. A trailing
        // straggler (account 31) is included so the last-processed tx — which the
        // final-blow bonus is (mis)attributed to and merged with — is NOT the account
        // we assert on, keeping account 30's refund a clean, unmerged amount.
        testbed.sendTransactionAndGetResponse([
            {sender: Context.SenderAccount1, recipient: Context.ThisContract, amount: 1100n * 1_0000_0000n + Context.ActivationFee},
            {sender: StragglerAccount,       recipient: Context.ThisContract, amount: StragglerSigna * 1_0000_0000n + Context.ActivationFee},
            {sender: 31n,                    recipient: Context.ThisContract, amount: 100n * 1_0000_0000n + Context.ActivationFee},
        ], Context.ThisContract);

        // The construct is defeated and the one-shot guard is set.
        expect(testbed.getContractMemoryValue('isDefeated', Context.ThisContract)).toBe(1n);
        expect(testbed.getContractMemoryValue('defeatHandled', Context.ThisContract)).toBe(1n);

        // The straggler's full SIGNA (getAmount excludes the activation fee) is
        // bounced back with the "already defeated" notice — not kept and swept into
        // the payout, which is what happened before the fix.
        const refund = testbed.getTransactions().find(tx =>
            tx.recipient === StragglerAccount && tx.amount === StragglerSigna * 1_0000_0000n);
        expect(refund).toBeDefined();
        expect(refund!.messageText).toContain("defeated");
    });

    test("the final blow is attributed to the finisher, not a trailing same-block tx", () => {
        const testbed = deployConstruct({
            maxHp: 100n,
            breachLimit: 100n,
            firstBloodBonus: 0n,             // isolate the final-blow bonus
            finalBlowBonus: 100_0000_0000n,
        });

        const TrailingAccount = 31n;
        // SenderAccount1 lands the killing blow; TrailingAccount's tx is processed
        // LAST in the same block. Before the fix, finalBlowAccount was read from the
        // last-processed sender, so the trailing account stole the victory bonus.
        testbed.sendTransactionAndGetResponse([
            {sender: Context.SenderAccount1, recipient: Context.ThisContract, amount: 1100n * 1_0000_0000n + Context.ActivationFee},
            {sender: TrailingAccount,        recipient: Context.ThisContract, amount: 100n * 1_0000_0000n + Context.ActivationFee},
        ], Context.ThisContract);

        // The final blow is credited to the actual finisher, captured at the kill.
        expect(testbed.getContractMemoryValue('finalBlowAccount', Context.ThisContract)).toBe(Context.SenderAccount1);

        // The trailing account only gets its own refund back (100 SIGNA) — the
        // 100-SIGNA victory bonus did NOT leak to it (which would merge to 200 SIGNA).
        const trailingRefund = testbed.getTransactions().find(tx =>
            tx.recipient === TrailingAccount && tx.amount === 100n * 1_0000_0000n);
        expect(trailingRefund).toBeDefined();
        const leakedBonus = testbed.getTransactions().some(tx =>
            tx.recipient === TrailingAccount && tx.amount === 200n * 1_0000_0000n);
        expect(leakedBonus).toBe(false);
    });
});
