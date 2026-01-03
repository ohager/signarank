import {describe, expect, test} from "vitest";
import {SimulatorTestbed} from "signum-smartc-testbed";
import {attack, BootstrapScenario, DefaultRequiredInitializers, getCurrentHitpoints, timeLapse} from "../lib";
import {Context} from "../context";

describe("Regeneration Mechanics", () => {
    test("should regenerate HP over time", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, {
                ...DefaultRequiredInitializers,
                maxHp: 1000n,
            })
            .runScenario();

        // Configure regeneration: 10 HP every 5 blocks
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetRegeneration, 5n, 10n], // 2 hp per block
        }])

        // Deal damage first
        attack({testbed, signa: 1000n})
        const hpAfterDamage = getCurrentHitpoints(testbed)!;
        expect(hpAfterDamage).toBe(900n);

        timeLapse({testbed, blocks: 3n});

        // Trigger regeneration by sending a transaction
        testbed.sendTransactionAndGetResponse([{ // are 2 blocks also
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetActive, 1n],
        }])

        const hpAfterRegen = getCurrentHitpoints(testbed)!;
        expect(hpAfterRegen).toBe(910n);
    })

    test("should cap regeneration at maxHp", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, {
                ...DefaultRequiredInitializers,
                maxHp: 1000n,
            })
            .runScenario();

        // Configure regeneration: 1000 HP every 5 blocks (huge amount)
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetRegeneration, 5n, 1000n],
        }])

        // Deal small damage
        attack({testbed, signa: 100n})
        const hpAfterDamage = getCurrentHitpoints(testbed)!;
        expect(hpAfterDamage).toBeLessThan(1000n);

        // Wait for regeneration
        timeLapse({testbed, blocks: 10n});

        // Trigger regeneration
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetActive, 1n],
        }])

        // Should not exceed maxHp
        const hpAfterRegen = getCurrentHitpoints(testbed)!;
        expect(hpAfterRegen).toBe(1000n);
    })

    test("should not regenerate when already at full HP", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, {
                ...DefaultRequiredInitializers,
                maxHp: 1000n,
            })
            .runScenario();

        // Configure regeneration
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetRegeneration, 5n, 100n],
        }])

        const initialHp = getCurrentHitpoints(testbed)!;
        expect(initialHp).toBe(1000n);

        // Wait for regeneration
        timeLapse({testbed, blocks: 10n});

        // Trigger regeneration
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetActive, 1n],
        }])

        // HP should remain at max
        expect(getCurrentHitpoints(testbed)).toBe(1000n);
    })

    test("should calculate proportional regeneration", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, {
                ...DefaultRequiredInitializers,
                maxHp: 10000n,
            })
            .runScenario();

        // Configure regeneration: 100 HP every 10 blocks
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetRegeneration, 10n, 100n],
        }])

        // Deal damage
        attack({testbed, signa: 10000n})
        const hpAfterDamage = getCurrentHitpoints(testbed)!;

        // Wait 20 blocks (should regen 200 HP)
        timeLapse({testbed, blocks: 20n});

        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetActive, 1n],
        }])

        const hpAfterRegen = getCurrentHitpoints(testbed)!;
        const regenerated = hpAfterRegen - hpAfterDamage;

        // Should have regenerated approximately 200 HP (20 blocks / 10 blocks * 100 HP)
        expect(regenerated).toBeGreaterThanOrEqual(180n);
        expect(regenerated).toBeLessThanOrEqual(220n);
    })

    test("should not regenerate when defeated", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, {
                ...DefaultRequiredInitializers,
                maxHp: 100n,
                breachLimit: 100n,
            })
            .runScenario();

        // Configure regeneration
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetRegeneration, 5n, 50n],
        }])

        // Defeat the construct
        attack({testbed, signa: 10000n})
        expect(getCurrentHitpoints(testbed)).toBe(0n);
        expect(testbed.getContractMemoryValue('isDefeated')).toBe(1n);

        // Wait for regeneration
        timeLapse({testbed, blocks: 10n});

        // Try to trigger regeneration
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetActive, 1n],
        }])

        // Should still be 0 (no regeneration when defeated)
        expect(getCurrentHitpoints(testbed)).toBe(0n);
    })
})
