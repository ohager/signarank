import {describe, expect, test} from "vitest";
import {SimulatorTestbed} from "signum-smartc-testbed";
import {attack, BootstrapScenario, DefaultRequiredInitializers, getCurrentHitpoints, timeLapse} from "../lib";
import {Context} from "../context";

describe("Cooldown Mechanics", () => {
    test("should prevent attack during cooldown", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, {
                ...DefaultRequiredInitializers,
                coolDownInBlocks: 15n,
            })
            .runScenario();

        const initialHp = getCurrentHitpoints(testbed)!;

        // First attack
        attack({testbed, signa: 100n})

        const hpAfterFirstAttack = getCurrentHitpoints(testbed)!;
        expect(hpAfterFirstAttack).toBeLessThan(initialHp);

        // Second attack immediately (same block)
        attack({testbed, signa: 100n})

        // HP should not change (attack blocked by cooldown)
        expect(testbed.getTransactions().some( tx => tx.recipient === Context.SenderAccount1 && tx.messageText?.startsWith("COOLDOWN")))
        expect(getCurrentHitpoints(testbed)).toBe(hpAfterFirstAttack);
    })

    test("should refund 90% of SIGNA during cooldown", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, {
                ...DefaultRequiredInitializers,
                coolDownInBlocks: 15n,
            })
            .runScenario();

        // First attack
        attack({testbed, signa: 100n})

        // Second attack immediately
        attack({testbed, signa: 100n})

        const refundTransactions =  testbed.getTransactions().slice(-2);
        expect(refundTransactions[0].messageText).toMatch("COOLDOWN")
        expect(refundTransactions[0].recipient).toBe(Context.SenderAccount1); // in planck
        expect(refundTransactions[0].amount).toBe(90_0000_0000n); // in planck
        expect(refundTransactions[1].recipient).toBe(0n); // burn
        expect(refundTransactions[1].amount).toBe(10_0000_0000n); // in planck
    })

    test("should allow attack after cooldown expires", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, {
                ...DefaultRequiredInitializers,
                coolDownInBlocks: 10n,
            })
            .runScenario();

        // First attack at block 1
        attack({testbed, signa: 100n})
        const hpAfterFirst = getCurrentHitpoints(testbed)!;

        // not cooled down yet
        timeLapse({testbed, blocks: 5n})

        attack({testbed, signa: 100n})
        expect(getCurrentHitpoints(testbed)).toBe(hpAfterFirst);

        // Advance blocks past cooldown
        timeLapse({testbed, blocks: 5n})

        // Second attack should work
        attack({testbed, signa: 100n})

        expect(getCurrentHitpoints(testbed)).toBeLessThan(hpAfterFirst);
    })
})
