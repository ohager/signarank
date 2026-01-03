import {describe, expect, test} from "vitest";
import {SimulatorTestbed} from "signum-smartc-testbed";
import {Context} from "../context";
import {getCurrentHitpoints, DefaultRequiredInitializers, BootstrapScenario, attack, timeLapse} from "../lib";

describe('Attack Mechanics', () => {
    describe("Basic Attack Mechanics", () => {
        test("should NOT run when inactive", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetActive, 0n],
            }])

            attack({
                testbed,
                signa: 30n
            })

            expect(getCurrentHitpoints(testbed)).toBe(DefaultRequiredInitializers.maxHp)
        })

        test("should NOT run when defeated", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, {
                    ...DefaultRequiredInitializers,
                    maxHp: 100n,
                    breachLimit: 100n,
                })
                .runScenario();

            // First attack to defeat
            attack({testbed, signa: 1000n})

            const hpAfterDefeat = getCurrentHitpoints(testbed);
            expect(hpAfterDefeat).toBe(0n);

            // Try to attack again
            attack({testbed, signa: 500n})

            // HP should still be 0
            expect(getCurrentHitpoints(testbed)).toBe(0n);
            expect(testbed.getContractMemoryValue("isDefeated")).toBe(1n)
        })

        test("should deal basic damage with SIGNA only", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const initialHp = getCurrentHitpoints(testbed)!;

            // Attack with 100 SIGNA
            // Default baseDamageRatio is 10, so damage = 100 * 10 / 100 = 10
            attack({testbed, signa: 100n})

            const finalHp = getCurrentHitpoints(testbed)!;
            const damage = initialHp - finalHp;

            expect(damage).toBe(10n);
        })

        test("should send XP and HP tokens to attacker", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const initialHp = getCurrentHitpoints(testbed)!;

            attack({testbed, signa: 100n})

            const damage = initialHp - getCurrentHitpoints(testbed)!;

            // Check attacker received XP tokens
            const attacker = testbed.getAccount(Context.SenderAccount1);
            const xpToken = attacker?.tokens.find(t => t.asset === Context.XPTokenId);
            expect(xpToken?.quantity).toBe(damage);

            // Check attacker received HP tokens
            const hpTokenId = testbed.getContractMemoryValue('hpTokenId');
            const hpToken = attacker?.tokens.find(t => t.asset === hpTokenId);
            expect(hpToken?.quantity).toBe(damage);
        })

        test("should track first blood", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            attack({testbed, signa: 100n, sender: Context.SenderAccount1})

            const firstBloodAccount = testbed.getContractMemoryValue('firstBloodAccount');
            expect(firstBloodAccount).toBe(Context.SenderAccount1);

            // Second attack should not change first blood
            attack({testbed, signa: 100n, sender: Context.SenderAccount2})
            expect(testbed.getContractMemoryValue('firstBloodAccount')).toBe(Context.SenderAccount1);
        })

        test("should refund the attackers signa and tokens if construct is inactive", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const PowerUpTokenId = 2000n;

            // Set construct to inactive
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetActive, 0n],
            }])

            // Attack while inactive
            attack({
                testbed,
                signa: 1n,
                tokens: [{asset: PowerUpTokenId, quantity: 5n}]
            })

            // Verify HP unchanged
            expect(getCurrentHitpoints(testbed)).toBe(DefaultRequiredInitializers.maxHp);

            // Verify attacker didn't receive XP/HP tokens
            const attacker = testbed.getAccount(Context.SenderAccount1);
            const xpToken = attacker?.tokens.find(t => t.asset === Context.XPTokenId);
            expect(xpToken).toBeUndefined();

            const tx = testbed.getTransactions().filter(tx => tx.recipient === Context.SenderAccount1 && tx.sender === Context.ThisContract)
            expect(tx.length).toBe(2)
            expect(tx[0].messageText).toMatch("Construct is not active!")
            expect(tx[0].amount).toBeLessThanOrEqual(1_0000_0000n); // 1 SIGNA attack
            expect(tx[1].tokens).toEqual([{asset: PowerUpTokenId, quantity: 5n}]);
        })
    })

    describe("Breach Limit Mechanics", () => {
        test("should limit damage per attack based on breach limit", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, {
                    ...DefaultRequiredInitializers,
                    maxHp: 10_000n,
                    breachLimit: 10n, // Max 10% of current HP per attack
                })
                .runScenario();

            const initialHp = getCurrentHitpoints(testbed)!;

            // Attack with huge amount that would exceed breach limit
            attack({testbed, signa: 100_000n})

            const damage = initialHp - getCurrentHitpoints(testbed)!;
            const maxDamage = (initialHp * 10n) / 100n;

            expect(damage).toBe(maxDamage);
        })

        test("should allow full damage if below breach limit", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, {
                    ...DefaultRequiredInitializers,
                    maxHp: 10_000n,
                    breachLimit: 50n, // Max 50% of current HP
                })
                .runScenario();

            const initialHp = getCurrentHitpoints(testbed)!;

            // Attack with small amount
            // baseDamageRatio = 10, so 100 SIGNA = 10 damage
            attack({testbed, signa: 100n})

            const damage = initialHp - getCurrentHitpoints(testbed)!;

            // Should deal exactly 10 damage (not limited)
            expect(damage).toBe(10n);
        })

        test("should breach limit edge cases - 1% (Minimum)", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, {
                    ...DefaultRequiredInitializers,
                    maxHp: 100n,
                    breachLimit: 1n,
                })
                .runScenario();

            const initialHp = getCurrentHitpoints(testbed)!;

            // Attack with small amount
            // baseDamageRatio = 10, so 100 SIGNA = 10 damage
            attack({testbed, signa: 100n})

            const damage = initialHp - getCurrentHitpoints(testbed)!;
            const maxDamage = (initialHp * 1n) / 100n;

            expect(damage).toBe(maxDamage);
        })

        test("should breach limit edge cases - 100% (Maximum)", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, {
                    ...DefaultRequiredInitializers,
                    maxHp: 1_000n,
                    breachLimit: 100n,
                })
                .runScenario();

            // Attack with excessive amount - one kill
            attack({testbed, signa: 20_000n})

            // all hitpoints gone
            expect(getCurrentHitpoints(testbed)).toBe(0n);
            const attacker = testbed.getAccount(Context.SenderAccount1)!
            const hpTokenId = testbed.getContractMemoryValue('hpTokenId')!;

            // check attacker received reward tokens
            expect(attacker).toBeDefined();
            expect(attacker.tokens.find(t => t.asset === Context.XPTokenId)?.quantity).toBe(1000n)
            expect(attacker.tokens.find(t => t.asset === hpTokenId)?.quantity).toBe(1000n)

        })

        test("should keep breach limit constant based on maxHp throughout battle", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, {
                    ...DefaultRequiredInitializers,
                    maxHp: 10_000n,
                    breachLimit: 20n, // 20% of maxHp = 2000 damage cap
                })
                .runScenario();

            const maxHp = 10_000n;
            const expectedMaxDamage = (maxHp * 20n) / 100n; // 2000

            // First attack at full HP
            const hpBefore1 = getCurrentHitpoints(testbed)!;
            attack({testbed, signa: 100_000n}) // Huge attack to hit breach limit
            const hpAfter1 = getCurrentHitpoints(testbed)!;
            const damage1 = hpBefore1 - hpAfter1;

            expect(damage1).toBe(expectedMaxDamage); // Should be capped at 2000

            // Second attack at reduced HP (8000 HP remaining)
            timeLapse({testbed, blocks: 20n});
            const hpBefore2 = getCurrentHitpoints(testbed)!;
            attack({testbed, signa: 100_000n, sender: Context.SenderAccount2}) // Same huge attack
            const hpAfter2 = getCurrentHitpoints(testbed)!;
            const damage2 = hpBefore2 - hpAfter2;

            expect(damage2).toBe(expectedMaxDamage); // Should STILL be capped at 2000

            // Third attack at even lower HP (6000 HP remaining)
            timeLapse({testbed, blocks: 20n});
            const hpBefore3 = getCurrentHitpoints(testbed)!;
            attack({testbed, signa: 100_000n, sender: Context.SenderAccount1})
            const hpAfter3 = getCurrentHitpoints(testbed)!;
            const damage3 = hpBefore3 - hpAfter3;

            expect(damage3).toBe(expectedMaxDamage); // Should STILL be capped at 2000

            // Verify damage cap stayed constant throughout the battle
            expect(damage1).toBe(damage2);
            expect(damage2).toBe(damage3);
        })
    })

    describe("Token Modifier Mechanics", () => {
        const PowerUpTokenId = 2000n;

        test("should apply damage multiplier from tokens - buffing", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            // Configure token with 5x multiplier (500 = 5.00x)
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDamageMultiplier, PowerUpTokenId, 500n, 1n],
            }])

            // Set token decimals to 0
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetTokenDecimals, PowerUpTokenId, 0n],
            }])

            const initialHp = getCurrentHitpoints(testbed)!;

            // Attack with 100 SIGNA and 1 power-up token
            // Base damage = 10, with 5x multiplier = 50
            attack({
                testbed,
                signa: 100n,
                tokens: [{asset: PowerUpTokenId, quantity: 1n}]
            })

            const damage = initialHp - getCurrentHitpoints(testbed)!;
            expect(damage).toBe(50n);
        })


        test("should apply damage multiplier from tokens - debuffing", async () => {
                    const testbed = new SimulatorTestbed(BootstrapScenario)
                        .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                        .runScenario();

                    // Configure token with 0.5x multiplier (50 = 0.5x)
                    testbed.sendTransactionAndGetResponse([{
                        sender: Context.CreatorAccount,
                        recipient: Context.ThisContract,
                        amount: Context.ActivationFee,
                        messageArr: [Context.Methods.SetDamageMultiplier, PowerUpTokenId, 50n, 2n],
                    }])

                    // Set token decimals to 0
                    testbed.sendTransactionAndGetResponse([{
                        sender: Context.CreatorAccount,
                        recipient: Context.ThisContract,
                        amount: Context.ActivationFee,
                        messageArr: [Context.Methods.SetTokenDecimals, PowerUpTokenId, 0n],
                    }])

                    const initialHp = getCurrentHitpoints(testbed)!;

                    // Attack with 100 SIGNA and 1 power-up token
                    // Base damage = 10, with 0.5x multiplier = 5
                    attack({
                        testbed,
                        signa: 100n,
                        tokens: [{asset: PowerUpTokenId, quantity: 1n}]
                    })

                    let damage = initialHp - getCurrentHitpoints(testbed)!;
                    expect(damage).toBe(5n);


                    timeLapse({testbed, blocks: 20n});

                    // Attack with 100 SIGNA and 2 power-up token
                    // Base damage = 10, with 0.5x0.5 multiplier = 0.25 => 2 damage
                    attack({
                        testbed,
                        signa: 100n,
                        tokens: [{asset: PowerUpTokenId, quantity: 2n}]
                    })

                    damage = initialHp - damage - getCurrentHitpoints(testbed)!;
                    expect(damage).toBe(2n);
                })

        test("should apply damage addition from tokens", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            // Configure token with +100 damage addition
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDamageAddition, PowerUpTokenId, 100n, 0n],
            }])

            // Set token decimals to 0
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetTokenDecimals, PowerUpTokenId, 0n],
            }])

            const initialHp = getCurrentHitpoints(testbed)!;

            // Attack with 100 SIGNA and 1 power-up token
            // Base damage = 10, with +100 addition = 110
            attack({
                testbed,
                signa: 100n,
                tokens: [{asset: PowerUpTokenId, quantity: 1n}]
            })

            const damage = initialHp - getCurrentHitpoints(testbed)!;
            expect(damage).toBe(110n);
        })

        test("should enforce token limit", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            // Configure token with 2x multiplier and limit of 5 tokens
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDamageMultiplier, PowerUpTokenId, 200n, 5n],
            }])

            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetTokenDecimals, PowerUpTokenId, 0n],
            }])

            const initialHp = getCurrentHitpoints(testbed)!;

            // Attack with 10 tokens (should be limited to 5)
            attack({
                testbed,
                signa: 100n,
                tokens: [{asset: PowerUpTokenId, quantity: 10n}]
            })

            // Base damage = 10, with 2x multiplier × 5 tokens = 100
            const damage = initialHp - getCurrentHitpoints(testbed)!;
            expect(damage).toBe(100n);
        })

        test("should apply multiple token modifiers in single attack", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const Token1 = 2000n;
            const Token2 = 2001n;
            const Token3 = 2002n;
            const Token4 = 2003n;

            // Configure Token1 with 2x multiplier
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDamageMultiplier, Token1, 200n, 0n],
            }])
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetTokenDecimals, Token1, 0n],
            }])

            // Configure Token2 with +50 damage addition
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDamageAddition, Token2, 50n, 0n],
            }])
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetTokenDecimals, Token2, 0n],
            }])

            // Configure Token3 with 3x multiplier
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDamageMultiplier, Token3, 300n, 0n],
            }])
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetTokenDecimals, Token3, 0n],
            }])

            // Configure Token4 with +100 damage addition
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDamageAddition, Token4, 100n, 0n],
            }])
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetTokenDecimals, Token4, 0n],
            }])

            const initialHp = getCurrentHitpoints(testbed)!;

            // Attack with 100 SIGNA and all 4 tokens
            // Base damage = 10
            // First pass - all additions: Token2 (+50) + Token4 (+100) = +150
            // After additions: 10 + 150 = 160
            // Second pass - all multipliers:
            // After Token1 (2x): 160 * 2 = 320
            // After Token3 (3x): 320 * 3 = 960
            attack({
                testbed,
                signa: 100n,
                tokens: [
                    {asset: Token1, quantity: 1n},
                    {asset: Token2, quantity: 1n},
                    {asset: Token3, quantity: 1n},
                    {asset: Token4, quantity: 1n}
                ]
            })

            const damage = initialHp - getCurrentHitpoints(testbed)!;
            expect(damage).toBe(960n);

            // attack with different tokens order
            timeLapse({testbed, blocks: 20n});
            attack({
                testbed,
                signa: 100n,
                tokens: [
                    {asset: Token2, quantity: 1n},
                    {asset: Token4, quantity: 1n},
                    {asset: Token1, quantity: 1n},
                    {asset: Token3, quantity: 1n},
                ]
            })

            const damage2 = initialHp - getCurrentHitpoints(testbed)! - damage;
            expect(damage2).toBe(960n);
        })

        test("should ignore unregistered tokens", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const initialHp = getCurrentHitpoints(testbed)!;

            // Attack with unregistered token
            attack({
                testbed,
                signa: 100n,
                tokens: [{asset: 9999n, quantity: 100n}]
            })

            // Should only deal base damage (10)
            const damage = initialHp - getCurrentHitpoints(testbed)!;
            expect(damage).toBe(10n);
        })
    })

    describe("Debuff Mechanics", () => {
        test("should apply debuff to reduce damage", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            // Configure debuff: 100% chance, 50% damage reduction, max 3 stacks
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDebuff, 100n, 50n, 3n],
            }])

            // First attack - should get debuffed
            attack({testbed, signa: 100n})

            // Get debuff stacks
            const debuffStacks = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);
            expect(debuffStacks).toBeGreaterThan(0n);

            const hpAfterFirst = getCurrentHitpoints(testbed)!;

            // Second attack - should have reduced damage due to debuff
            timeLapse({testbed, blocks: 20n})
            attack({testbed, signa: 100n})

            const hpAfterSecond = getCurrentHitpoints(testbed)!;
            const secondDamage = hpAfterFirst - hpAfterSecond;

            // With 50% reduction, damage should be 5 instead of 10
            expect(secondDamage).toBe(5n);
        })

        test("should reduce debuff stack after application", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            // Configure debuff
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDebuff, 100n, 25n, 5n],
            }])

            // First attack - get debuffed (1 stack)
            attack({testbed, signa: 100n})

            const stacksAfterFirst = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);
            expect(stacksAfterFirst).toBe(1n);

            // Second attack - stack should be consumed and reduced
            timeLapse({testbed, blocks: 20n})
            attack({testbed, signa: 100n})

            const stacksAfterSecond = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);
            expect(stacksAfterSecond).toBe(1n); // New stack from counter, old one consumed
        })

        test("should not exceed max debuff stacks", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            // Configure debuff with max 2 stacks
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDebuff, 100n, 20n, 2n],
            }])

            // Attack multiple times to try to stack debuff
            attack({testbed, signa: 100n})
            timeLapse({testbed, blocks: 20n})
            attack({testbed, signa: 100n})
            timeLapse({testbed, blocks: 20n})
            attack({testbed, signa: 100n})

            // Should not exceed max stacks
            const stacks = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);
            expect(stacks).toBeLessThanOrEqual(2n);
        })

        test("should never apply debuff when chance is 0%", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            // Configure debuff with 0% chance
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDebuff, 0n, 50n, 5n],
            }])

            // Attack multiple times
            for(let i = 0; i < 10; i++) {
                attack({testbed, signa: 100n})
                timeLapse({testbed, blocks: 20n})
            }

            // Should never get debuffed
            const stacks = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);
            expect(stacks).toBe(0n);
        })

        test("should apply debuff probabilistically with 50% chance", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            // Configure debuff with 50% chance
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDebuff, 50n, 25n, 10n],
            }])

            const iterations = 50;
            const runs = 6;
            const debuffsCount = new Set<number>();
            // Run many attacks and count debuffs
            for(let j = 0; j < runs; j++) {
                let debuffCount = 0;
                for(let i = 0; i < iterations; i++) {
                    const stacksBefore = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);

                    attack({testbed, signa: 100n})
                    timeLapse({testbed, blocks: 20n})

                    const stacksAfter = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);

                    // Counter attack occurred if stacks increased
                    if(stacksAfter > stacksBefore) {
                        debuffCount++;
                    }
                }
                debuffsCount.add(debuffCount);
            }

            // expect have at least 50% different debuff counts
            expect(debuffsCount.size).toBeGreaterThanOrEqual(runs/2);
            debuffsCount.forEach( c => {
                // the randomness for simulator is weaker than real world,
                // so we expect only different values, but not statistically correct
                expect(c).toBeGreaterThan(1);
            })

        })

        test("should scale counter attack chance when damage exceeds breach limit", async () => {
            // Use 100% counter attack chance for deterministic testing
            // maxHp: 1000, breachLimit: 10% = 100 max damage
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, {
                    ...DefaultRequiredInitializers,
                    maxHp: 1000n,
                    breachLimit: 10n, // Different from default 20%
                })
                .runScenario();

            // Configure 100% counter chance for deterministic behavior
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDebuff, 100n, 25n, 50n],
            }])

            // Attack with high damage that exceeds breach limit
            // 10,000 SIGNA * 10% = 1000 damage (before breach limit)
            // breachLimitDamage = (1000 * 10) / 100 = 100
            // rawDamage (1000) >> breachLimitDamage (100)
            // With 100% base chance and scaling, should always trigger
            attack({testbed, signa: 10_000n})

            // Should get debuff stack with 100% chance when exceeding breach
            const stacks = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);
            expect(stacks).toBeGreaterThan(0n);
        })

        test("should use base chance when damage is below breach limit", async () => {
            // maxHp: 10000, breachLimit: 20% = 2000 max damage
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, {
                    ...DefaultRequiredInitializers,
                    maxHp: 10000n,
                    breachLimit: 20n,
                })
                .runScenario();

            // Configure debuff: 10% base chance (low)
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDebuff, 10n, 25n, 20n],
            }])

            // Attack with 100 SIGNA = 10 damage (well below breach limit of 2000)
            // Should use base 10% chance
            const iterations = 50;
            let counterAttackCount = 0;

            for(let i = 0; i < iterations; i++) {
                const stacksBefore = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);

                attack({testbed, signa: 100n})
                timeLapse({testbed, blocks: 20n})

                const stacksAfter = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);

                if(stacksAfter > stacksBefore) {
                    counterAttackCount++;
                }
            }

            // With 10% chance, expect around 5 out of 50 (allow some variance)
            // Should be significantly less than if it was scaling up
            expect(counterAttackCount).toBeLessThan(20); // Well below what scaled chance would give
        })

        test("should scale counter attack chance proportionally", async () => {
            // Test with 100% chance to ensure counter attacks happen
            // maxHp: 1000, breachLimit: 10% = 100 max damage
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, {
                    ...DefaultRequiredInitializers,
                    maxHp: 1000n,
                    breachLimit: 10n, // Different from default
                })
                .runScenario();

            // Configure 100% counter chance
            testbed.sendTransactionAndGetResponse([{
                sender: Context.CreatorAccount,
                recipient: Context.ThisContract,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDebuff, 100n, 25n, 50n],
            }])

            // Attack below breach limit - should use 100% base chance
            attack({testbed, signa: 100n}) // 10 damage, well below 100 breach limit
            let stacks1 = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);
            expect(stacks1).toBe(1n); // Should get 1 stack with 100% chance

            timeLapse({testbed, blocks: 20n})

            // Attack above breach limit - should still use 100% (or capped at 90%)
            attack({testbed, signa: 10_000n}) // 1000 damage, way above 100 breach limit
            let stacks2 = testbed.getContractMapValue(Context.Maps.AttackerDebuff, Context.SenderAccount1);
            // Should be 1 (previous stack consumed, new stack added)
            expect(stacks2).toBe(1n);
        })
    })

    describe("Multiple Attackers", () => {
        test("should handle attacks from different accounts", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, DefaultRequiredInitializers)
                .runScenario();

            const initialHp = getCurrentHitpoints(testbed)!;

            // First attacker
            attack({testbed, signa: 100n, sender: Context.SenderAccount1})
            const hpAfterFirst = getCurrentHitpoints(testbed)!;

            timeLapse({testbed, blocks: 2n})

            // Second attacker
            attack({testbed, signa: 100n, sender: Context.SenderAccount2})
            const hpAfterSecond = getCurrentHitpoints(testbed)!;

            // Both should deal damage
            expect(hpAfterFirst).toBeLessThan(initialHp);
            expect(hpAfterSecond).toBeLessThan(hpAfterFirst);
        })

        test("should track cooldowns independently per attacker", async () => {
            const testbed = new SimulatorTestbed(BootstrapScenario)
                .loadContract(Context.ContractPath, {
                    ...DefaultRequiredInitializers,
                    coolDownInBlocks: 15n,
                })
                .runScenario();

            // Attacker 1 attacks
            attack({testbed, signa: 100n, sender: Context.SenderAccount1})
            const hpAfterFirst = getCurrentHitpoints(testbed)!;
            const sender1LastHit = testbed.getContractMapValue(Context.Maps.AttackersLastAttack, Context.SenderAccount1)
            expect(sender1LastHit).toBe(5n);

            // Attacker 2 can attack immediately (different account)
            attack({testbed, signa: 100n, sender: Context.SenderAccount2})
            const sender2LastHit = testbed.getContractMapValue(Context.Maps.AttackersLastAttack, Context.SenderAccount2)
            expect(sender2LastHit).toBe(7n);

            expect(getCurrentHitpoints(testbed)).toBeLessThan(hpAfterFirst);
        })
    })

})
