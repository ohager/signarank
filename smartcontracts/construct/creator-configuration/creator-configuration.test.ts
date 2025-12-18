import {describe, expect, test} from "vitest";

import {SimulatorTestbed, utils} from "signum-smartc-testbed";
import {Context} from "../context";
import {BootstrapScenario} from "./creator-configuration.scenarios";

const DefaultRequiredInitializers = {
    name: "CT000001",
    xpTokenId: Context.XPTokenId,
    maxHp: 50_000n,
}

const MAP_SET_FLAG = 1024n;

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

    describe('setDamageMultiplier', () => {
        const TestTokenId = 5000n;

        test('should set damage multiplier with valid values', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, 2n],
                    recipient: Context.ThisContract,
                },
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageMultiplier, TestTokenId, 150n, 20n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const hasWarning = testbed.blockchain.transactions.some(tx => tx.recipient === Context.CreatorAccount && tx.messageText?.startsWith("Unregistered Token"))
            expect(hasWarning).toBeFalsy();
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(2n + MAP_SET_FLAG);
            expect(testbed.getContractMapValue(Context.Maps.DamageMultiplier, TestTokenId)).toBe(150n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(20n);
        })
        test('should set damage multiplier with valid values - but sends a warning that token is not registered', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageMultiplier, TestTokenId, 150n, 20n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const hasWarning = testbed.blockchain.transactions.some(tx => tx.recipient === Context.CreatorAccount && tx.messageText?.startsWith("Unregistered Token"))
            expect(hasWarning).toBeTruthy();
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(0n);
            expect(testbed.getContractMapValue(Context.Maps.DamageMultiplier, TestTokenId)).toBe(150n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(20n);
        })

        test('should NOT set damage multiplier when sender is not creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, 2n],
                    recipient: Context.ThisContract,
                },
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetDamageMultiplier, TestTokenId, 150n, 1000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            const hasWarning = testbed.blockchain.transactions.some(tx => tx.recipient === Context.CreatorAccount && tx.messageText?.startsWith("Unregistered Token"))
            expect(hasWarning).toBeFalsy();

            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(0n);
            expect(testbed.getContractMapValue(Context.Maps.DamageMultiplier, TestTokenId)).toBe(0n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(0n);
        })

        test('should NOT set multiplier when value is 0', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageMultiplier, TestTokenId, 0n, 1000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageMultiplier, TestTokenId)).toBe(0n); // Should not be set
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(1000n);
        })

        test('should NOT set multiplier when value > 1000', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageMultiplier, TestTokenId, 1001n, 1000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageMultiplier, TestTokenId)).toBe(0n); // Should not be set
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(1000n);
        })

        test('should set multiplier with edge case value 1', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageMultiplier, TestTokenId, 1n, 0n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageMultiplier, TestTokenId)).toBe(1n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(0n);
        })

        test('should set multiplier with edge case value 1000', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageMultiplier, TestTokenId, 1000n, 5000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageMultiplier, TestTokenId)).toBe(1000n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(5000n);
        })
    })

    describe('setDamageAddition', () => {
        const TestTokenId = 5500n;
        test('should set damage addition with valid values and registered token', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, 2n],
                    recipient: Context.ThisContract,
                },
                {
                    blockheight: 3,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageAddition, TestTokenId, 100n, 50n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const hasWarning = testbed.blockchain.transactions.some(tx => tx.recipient === Context.CreatorAccount && tx.messageText?.startsWith("Unregistered Token"))
            expect(hasWarning).toBeFalsy();
            expect(testbed.getContractMapValue(Context.Maps.DamageAddition, TestTokenId)).toBe(50n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(100n);
        })

        test('should set damage addition with valid values - but sends a warning that token is not registered', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageAddition, TestTokenId, 100n, 50n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const hasWarning = testbed.blockchain.transactions.some(tx => tx.recipient === Context.CreatorAccount && tx.messageText?.startsWith("Unregistered Token"))
            expect(hasWarning).toBeTruthy();
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(0n);
            expect(testbed.getContractMapValue(Context.Maps.DamageAddition, TestTokenId)).toBe(50n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(100n);
        })

        test('should NOT set damage addition when sender is not creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetDamageAddition, TestTokenId, 100n, 50n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageAddition, TestTokenId)).toBe(0n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(0n);
        })

        test('should NOT set damage addition when value is 0', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageAddition, TestTokenId, 100n, 0n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageAddition, TestTokenId)).toBe(0n);
            // But tokenLimit should still be set
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(100n);
        })

        test('should NOT set damage addition when value is negative', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageAddition, TestTokenId, 100n, -50n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageAddition, TestTokenId)).toBe(0n);
            // But tokenLimit should still be set
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(100n);
        })

        test('should set damage addition with edge case value 1', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageAddition, TestTokenId, 0n, 1n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageAddition, TestTokenId)).toBe(1n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(0n);
        })

        test('should set damage addition with large value', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageAddition, TestTokenId, 10000n, 5000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageAddition, TestTokenId)).toBe(5000n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(10000n);
        })

        test('should set tokenLimit to 0 when value is exactly 0', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageAddition, TestTokenId, 0n, 100n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageAddition, TestTokenId)).toBe(100n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(0n);
        })

        test('should NOT set tokenLimit when value is negative', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDamageAddition, TestTokenId, -100n, 50n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.DamageAddition, TestTokenId)).toBe(50n);
            expect(testbed.getContractMapValue(Context.Maps.DamageTokenLimit, TestTokenId)).toBe(0n);
        })
    })

    describe('setRewardDistribution', () => {
        test('should set reward distribution with valid values that sum to 100', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardDistribution, 70n, 20n, 10n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(70n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(20n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(10n);
        })

        test('should NOT set reward distribution when sender is not creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetRewardDistribution, 70n, 20n, 10n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // Should remain default values
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(85n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(10n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(5n);
        })

        test('should NOT set reward distribution when sum is less than 100', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardDistribution, 70n, 20n, 9n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // Should remain default values (sum is 99, not 100)
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(85n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(10n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(5n);
        })

        test('should NOT set reward distribution when sum is greater than 100', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardDistribution, 70n, 20n, 11n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // Should remain default values (sum is 101, not 100)
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(85n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(10n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(5n);
        })

        test('should NOT set reward distribution when attackers is negative', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardDistribution, -10n, 60n, 50n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // Should remain default values (attackers is negative)
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(85n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(10n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(5n);
        })

        test('should NOT set reward distribution when burn is negative', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardDistribution, 60n, -10n, 50n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // Should remain default values (burn is negative)
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(85n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(10n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(5n);
        })

        test('should NOT set reward distribution when treasury is negative', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardDistribution, 60n, 50n, -10n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // Should remain default values (treasury is negative)
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(85n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(10n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(5n);
        })

        test('should set reward distribution with edge case: all to attackers', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardDistribution, 100n, 0n, 0n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(100n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(0n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(0n);
        })

        test('should set reward distribution with edge case: all to burn', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardDistribution, 0n, 100n, 0n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(0n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(100n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(0n);
        })

        test('should set reward distribution with edge case: all to treasury', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardDistribution, 0n, 0n, 100n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(0n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(0n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(100n);
        })

        test('should set reward distribution with equal distribution', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardDistribution, 33n, 33n, 34n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('rewardDistribution_attackers')).toBe(33n);
            expect(testbed.getContractMemoryValue('rewardDistribution_burn')).toBe(33n);
            expect(testbed.getContractMemoryValue('rewardDistribution_treasury')).toBe(34n);
        })
    })

    describe('setRewardNft', () => {
        const TestNftId = 8000n;

        test('should set reward NFT with valid NFT ID', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRewardNft, TestNftId],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            // Note: In testbed, getCreatorOf might not validate NFT existence properly
            // This test assumes the NFT exists in the testbed environment
            expect(testbed.getContractMemoryValue('rewardNftId')).toBe(TestNftId);
        })

        test('should NOT set reward NFT when sender is not creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetRewardNft, TestNftId],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            expect(testbed.getContractMemoryValue('rewardNftId')).toBe(0n);
        })
    })

    describe('setDebuff', () => {
        test('should set debuff with valid positive values', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDebuff, 25n, 10n, 3n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('debuff_chance')).toBe(25n);
            expect(testbed.getContractMemoryValue('debuff_damageReduction')).toBe(10n);
            expect(testbed.getContractMemoryValue('debuff_maxStack')).toBe(3n);
        })

        test('should set debuff with negative damageReduction (buff effect)', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDebuff, 30n, -20n, 5n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('debuff_chance')).toBe(30n);
            expect(testbed.getContractMemoryValue('debuff_damageReduction')).toBe(-20n); // Negative = buff
            expect(testbed.getContractMemoryValue('debuff_maxStack')).toBe(5n);
        })

        test('should NOT set debuff when sender is not creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetDebuff, 25n, 10n, 3n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // Should remain default (all 0)
            expect(testbed.getContractMemoryValue('debuff_chance')).toBe(0n);
            expect(testbed.getContractMemoryValue('debuff_damageReduction')).toBe(0n);
            expect(testbed.getContractMemoryValue('debuff_maxStack')).toBe(0n);
        })

        test('should NOT set chance when value is negative', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDebuff, -10n, 15n, 3n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('debuff_chance')).toBe(0n); // Not set
            expect(testbed.getContractMemoryValue('debuff_damageReduction')).toBe(15n); // Set anyway
            expect(testbed.getContractMemoryValue('debuff_maxStack')).toBe(3n); // Set anyway
        })

        test('should NOT set maxStack when value is negative', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDebuff, 20n, 10n, -5n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('debuff_chance')).toBe(20n); // Set
            expect(testbed.getContractMemoryValue('debuff_damageReduction')).toBe(10n); // Set
            expect(testbed.getContractMemoryValue('debuff_maxStack')).toBe(0n); // Not set
        })

        test('should set debuff with edge case: 0 chance disables debuff', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDebuff, 0n, 20n, 5n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('debuff_chance')).toBe(0n);
            expect(testbed.getContractMemoryValue('debuff_damageReduction')).toBe(20n);
            expect(testbed.getContractMemoryValue('debuff_maxStack')).toBe(5n);
        })

        test('should set debuff with edge case: 100% chance', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetDebuff, 100n, 50n, 10n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('debuff_chance')).toBe(100n);
            expect(testbed.getContractMemoryValue('debuff_damageReduction')).toBe(50n);
            expect(testbed.getContractMemoryValue('debuff_maxStack')).toBe(10n);
        })
    })

    describe('setRegeneration', () => {
        test('should set regeneration with valid values', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRegeneration, 10n, 100n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('regeneration_blockInterval')).toBe(10n);
            expect(testbed.getContractMemoryValue('regeneration_hitpoints')).toBe(100n);
        })

        test('should NOT set regeneration when sender is not creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetRegeneration, 10n, 100n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // Should remain default (0)
            expect(testbed.getContractMemoryValue('regeneration_blockInterval')).toBe(0n);
            expect(testbed.getContractMemoryValue('regeneration_hitpoints')).toBe(0n);
        })

        test('should NOT set blockInterval when value is negative', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRegeneration, -10n, 100n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('regeneration_blockInterval')).toBe(0n); // Not set
            expect(testbed.getContractMemoryValue('regeneration_hitpoints')).toBe(100n); // Set anyway
        })

        test('should NOT set hitpoints when value is negative', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRegeneration, 10n, -100n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('regeneration_blockInterval')).toBe(10n); // Set
            expect(testbed.getContractMemoryValue('regeneration_hitpoints')).toBe(0n); // Not set
        })

        test('should NOT set hitpoints when value exceeds maxHp', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRegeneration, 10n, 60000n], // maxHp is 50000
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('regeneration_blockInterval')).toBe(10n); // Set
            expect(testbed.getContractMemoryValue('regeneration_hitpoints')).toBe(0n); // Not set (exceeds maxHp)
        })

        test('should set regeneration with edge case: hitpoints equals maxHp', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRegeneration, 5n, 50000n], // maxHp is 50000
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('regeneration_blockInterval')).toBe(5n);
            expect(testbed.getContractMemoryValue('regeneration_hitpoints')).toBe(50000n);
        })

        test('should set regeneration with edge case: 0 values disable regeneration', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetRegeneration, 0n, 0n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMemoryValue('regeneration_blockInterval')).toBe(0n);
            expect(testbed.getContractMemoryValue('regeneration_hitpoints')).toBe(0n);
        })
    })

    describe('heal', () => {

        function getCurrentHitpoints(testbed: SimulatorTestbed){
            const hpTokenId = testbed.getContractMemoryValue('hpTokenId');
            const hpToken = testbed.getContract().tokens.find(t => t.asset === hpTokenId);
            return hpToken?.quantity
        }

        test('should heal construct with valid hitpoints', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.Heal, 1000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            expect(getCurrentHitpoints(testbed)).toBe(50000n);
        })

        test('should NOT heal when sender is not creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.Heal, 1000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            expect(getCurrentHitpoints(testbed)).toBe(50000n);
        })

        test('should NOT heal when sent hitpoints is 0', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.Heal, 0n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            expect(getCurrentHitpoints(testbed)).toBe(50000n);
        })

        test('should NOT heal when hitpoints is negative', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.Heal, -1000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            expect(getCurrentHitpoints(testbed)).toBe(50000n);
        })

        test('should cap healing at maxHp when healing would exceed max', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.Heal, 60000n], // Exceeds maxHp
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            expect(getCurrentHitpoints(testbed)).toBe(50000n);
        })

        test('should send healing message to creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.Heal, 1000n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const hasHealingMessage = testbed.blockchain.transactions.some(tx =>
                tx.recipient === Context.CreatorAccount && tx.messageText?.startsWith("HEALING:")
            );
            expect(hasHealingMessage).toBeTruthy();
        })

        test('should heal construct with valid hitpoints', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee + 3000_0000_0000n, // 3000 SIGNA -> 300 HP
                    sender: Context.SenderAccount1,
                    recipient: Context.ThisContract,
                }
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const hp =  getCurrentHitpoints(testbed);
            expect(hp).toBe(49700n);

            testbed.sendTransactionAndGetResponse([
                {
                    blockheight: 4,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.Heal, 200n],
                    recipient: Context.ThisContract,
                },
            ])

            expect(getCurrentHitpoints(testbed)).toBe(49900n);
        })
    })

    describe('setTokenDecimals', () => {
        const TestTokenId = 6000n;
        test('should set token decimals with valid value', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, 2n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // Value should be stored with MAP_SET_FLAG added
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(2n + MAP_SET_FLAG);
        })

        test('should NOT set token decimals when sender is not creator', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.SenderAccount1,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, 2n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(0n);
        })

        test('should NOT set token decimals with value < 0', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, -1n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(0n);
        })

        test('should NOT set token decimals with value > 6', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, 7n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(0n);
        })

        test('should set token decimals with edge case value 0', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, 0n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // 0 is valid, should be stored with flag
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(0n + MAP_SET_FLAG);
        })

        test('should set token decimals with edge case value 6', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, 6n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            // 6 is max valid value, should be stored with flag
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(6n + MAP_SET_FLAG);
        })

        test('should allow updating token decimals', () => {
            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, 2n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(2n + MAP_SET_FLAG);

            // Update to different value
            testbed.sendTransactionAndGetResponse([
                {
                    blockheight: 3,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetTokenDecimals, TestTokenId, 4n],
                    recipient: Context.ThisContract,
                },
            ], Context.ThisContract);
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, TestTokenId)).toBe(4n + MAP_SET_FLAG);
        })

        test('should distinguish between unset token (0) and token with 0 decimals (1024)', () => {
            const UnsetTokenId = 7000n;
            const ZeroDecimalTokenId = 7001n;

            const testbed = new SimulatorTestbed([
                ...BootstrapScenario,
                {
                    blockheight: 2,
                    amount: Context.ActivationFee,
                    sender: Context.CreatorAccount,
                    messageArr: [Context.Methods.SetTokenDecimals, ZeroDecimalTokenId, 0n],
                    recipient: Context.ThisContract,
                },
            ])
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            // Unset token should return 0
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, UnsetTokenId)).toBe(0n);
            // Token with 0 decimals should return 0 + MAP_SET_FLAG
            expect(testbed.getContractMapValue(Context.Maps.TokenDecimalsInfo, ZeroDecimalTokenId)).toBe(0n + MAP_SET_FLAG);
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
