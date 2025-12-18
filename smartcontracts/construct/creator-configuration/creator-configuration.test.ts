import {describe, expect, test} from "vitest";

import {SimulatorTestbed, utils} from "signum-smartc-testbed";
import {Context} from "../context";
import {BootstrapScenario} from "./creator-configuration.scenarios";

const DefaultRequiredInitializers = {
    name: "CT000001",
    xpTokenId: Context.XPTokenId,
    maxHp: 50_000n,
}


describe('Construct Contract - Creator Configuration', () => {
    test('should have default initialization as expected', () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, DefaultRequiredInitializers)
            .runScenario();
        const name = testbed.getContractMemoryValue('name') ?? 0n;
        expect(utils.long2string(name)).toBe("CT000001")
        expect(testbed.getContractMemoryValue('xpTokenId')).toBe(Context.XPTokenId)
        expect(testbed.getContractMemoryValue('maxHp')).toBe(50_000n)
        expect(testbed.getContractMemoryValue('baseDamageRatio')).toBe(10n)
        expect(testbed.getContractMemoryValue('breachLimit')).toBe(20n)
        expect(testbed.getContractMemoryValue('firstBloodBonus')).toBe(1000_0000_0000n)
        expect(testbed.getContractMemoryValue('finalBlowBonus')).toBe(5000_0000_0000n)
        expect(testbed.getContractMemoryValue('coolDownInBlocks')).toBe(15n)
        expect(testbed.getContractMemoryValue('coolDownInBlocks')).toBe(15n)
        expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(85n)
        expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(10n)
        expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(5n)
        // no regeneration
        expect(testbed.getContractMemoryValue('regeneration_blockInterval')).toBe(0n)
        expect(testbed.getContractMemoryValue('regeneration_hitpoints')).toBe(0n)
        expect(testbed.getContractMemoryValue('regeneration_lastRegenerationBlock')).toBe(0n)
        // no debuffs aka counter attacks
        expect(testbed.getContractMemoryValue('debuff_chance')).toBe(0n)
        expect(testbed.getContractMemoryValue('debuff_damageReduction')).toBe(0n)
        expect(testbed.getContractMemoryValue('debuff_maxStack')).toBe(0n)

        expect(testbed.getContractMemoryValue('isActive')).toBe(1n)
        expect(testbed.getContractMemoryValue('isDefeated')).toBe(0n)
        expect(testbed.getContractMemoryValue('hpTokenId')).toBeGreaterThan(0n)


        // more to come
    })

    describe('setBoni', () => {
        test('should setBoni as expected', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetBoni, 500_0000_0000n, 2500_0000_0000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('firstBloodBonus')).toBe(500_0000_0000n)
            expect(testbed.getContractMemoryValue('finalBlowBonus')).toBe(2500_0000_0000n)
        })
        test('should NOT setBoni as sender is not creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetBoni, 500_0000_0000n, 2500_0000_0000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('firstBloodBonus')).not.toBe(500_0000_0000n)
            expect(testbed.getContractMemoryValue('finalBlowBonus')).not.toBe(2500_0000_0000n)
        })
        test('should NOT setBoni as values are invalid', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetBoni, -500_0000_0000n, -2500_0000_0000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('firstBloodBonus')).not.toBe(-500_0000_0000n)
            expect(testbed.getContractMemoryValue('finalBlowBonus')).not.toBe(-2500_0000_0000n)
        })
    })

    describe('setBreachLimit', () => {
        test('should set breach limit with valid value', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetBreachLimit, 50n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('breachLimit')).toBe(50n)
        })
        test('should NOT set breach limit when sender is not creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetBreachLimit, 50n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('breachLimit')).toBe(20n) // Should remain default
        })
        test('should NOT set breach limit with value <= 0', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetBreachLimit, 0n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('breachLimit')).toBe(20n) // Should remain default
        })
        test('should NOT set breach limit with value >= 100', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetBreachLimit, 100n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('breachLimit')).toBe(20n) // Should remain default
        })
        test('should set breach limit with edge case value 1', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetBreachLimit, 1n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('breachLimit')).toBe(1n)
        })
        test('should set breach limit with edge case value 99', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetBreachLimit, 99n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('breachLimit')).toBe(99n)
        })
    })

    describe('setActive', () => {
        test('should set contract to inactive and active state', () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('isActive')).toBe(1n)
            testbed.sendTransactionAndGetResponse([
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetActive, 0n],
                    recipient: Context.ThisContract,
                },
            ], Context.ThisContract);
            expect(testbed.getContractMemoryValue('isActive')).toBe(0n)
            testbed.sendTransactionAndGetResponse([
                {
                    blockheight: 3,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetActive, 1n],
                    recipient: Context.ThisContract,
                },
            ], Context.ThisContract);
            expect(testbed.getContractMemoryValue('isActive')).toBe(1n)

        })
        test('should set contract to exactly "1"', () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('isActive')).toBe(1n)
            testbed.sendTransactionAndGetResponse([
                {
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetActive, 0n],
                    recipient: Context.ThisContract,
                },
            ], Context.ThisContract);
            expect(testbed.getContractMemoryValue('isActive')).toBe(0n)
            testbed.sendTransactionAndGetResponse([
                {
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetActive, -10n],
                    recipient: Context.ThisContract,
                },
            ], Context.ThisContract);
            expect(testbed.getContractMemoryValue('isActive')).toBe(1n)
            testbed.sendTransactionAndGetResponse([
                {
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetActive, 0n],
                    recipient: Context.ThisContract,
                },
            ], Context.ThisContract);
            expect(testbed.getContractMemoryValue('isActive')).toBe(0n)
            testbed.sendTransactionAndGetResponse([
                {
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetActive, 10n],
                    recipient: Context.ThisContract,
                },
            ], Context.ThisContract);
            expect(testbed.getContractMemoryValue('isActive')).toBe(1n)
        })
        test('should NOT set contract to inactive and active state as sender is not creator', () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('isActive')).toBe(1n)
            testbed.sendTransactionAndGetResponse([
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetActive, 0n],
                    recipient: Context.ThisContract,
                },
            ], Context.ThisContract);
            expect(testbed.getContractMemoryValue('isActive')).toBe(1n)

        })
    })

})
