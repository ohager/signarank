import {describe, expect, test} from "vitest";
import {SimulatorTestbed} from "signum-smartc-testbed";
import {attack, BootstrapScenario, DefaultRequiredInitializers, timeLapse} from "../lib";
import {Context} from "../context";

describe("Event System", () => {
    const EventListenerAccount = 999n;

    function getEventList(testbed: SimulatorTestbed) {
        return testbed.getTransactions().filter(tx =>
            tx.recipient === EventListenerAccount
            && tx.messageArr.length > 0
            && tx.messageArr[0] >= 600n
            && tx.messageArr[0] <= 666n
        );
    }

    test("should send event when toggling active status", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, DefaultRequiredInitializers)
            .runScenario();

        // Set event listener
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetEventListener, EventListenerAccount],
        }])

        // Toggle active status
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetActive, 0n],
        }])

        let hasEvent = getEventList(testbed).some(tx => tx.messageArr[0] === 600n && tx.messageArr[1] === 0n);
        expect(hasEvent).toBeTruthy();

        // Toggle active status
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetActive, 1n],
        }])

        hasEvent = getEventList(testbed).slice(-1).some(tx => tx.messageArr[0] === 600n && tx.messageArr[1] === 1n);
        expect(hasEvent).toBeTruthy();
    })

    test("should send event when construct is hit", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, DefaultRequiredInitializers)
            .runScenario();

        // Set event listener
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetEventListener, EventListenerAccount],
        }])

        // Attack
        attack({testbed, signa: 100n})

        const hitEvent = getEventList(testbed).find(tx => tx.messageArr[0] === 601n);
        expect(hitEvent).toBeDefined();
        expect(hitEvent?.messageArr).toEqual([601n, Context.SenderAccount1, 10n, 49990n]);
    })

    test("should send event when construct is healed", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, DefaultRequiredInitializers)
            .runScenario();

        // Set event listener
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetEventListener, EventListenerAccount],
        }])

        // Deal damage first
        attack({testbed, signa: 5000n}) // 500n effective damage

        timeLapse({testbed, blocks: 5n});

        // Heal
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.Heal, 50n],
        }])

        const healEvent = getEventList(testbed).find(tx => tx.messageArr[0] === 602n); // 602 = 0x25a
        expect(healEvent).toBeDefined();
        expect(healEvent?.messageArr).toEqual([602n, Context.CreatorAccount, 50n, 49550n]);
    })

    test("should send event when counter attack occurs", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, DefaultRequiredInitializers)
            .runScenario();

        // Set event listener
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetEventListener, EventListenerAccount],
        }])

        // Configure debuff with 100% counter chance
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetDebuff, 100n, 50n, 5n],
        }])

        // Attack to trigger counter
        attack({testbed, signa: 100n})
        const hasEvent = getEventList(testbed).find(tx => tx.messageArr[0] === 603n && tx.messageArr[1] === Context.SenderAccount1); // 603 = 0x25b
        expect(hasEvent).toBeTruthy();
    })

    test("should send event when construct is defeated", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, {
                ...DefaultRequiredInitializers,
                maxHp: 100n,
                breachLimit: 100n,
            })
            .runScenario();

        // Set event listener
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetEventListener, EventListenerAccount],
        }])

        // Defeat
        attack({testbed, signa: 10000n})

        const defeatEvent = getEventList(testbed).find(tx => tx.messageArr[0] === 666n); // 666 = 0x29a
        expect(defeatEvent).toBeDefined();
        expect(defeatEvent?.messageArr).toEqual([666n, Context.SenderAccount1, 0n, 0n])
    })

    test("should NOT send events when listener is not configured", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, DefaultRequiredInitializers)
            .runScenario();

        // No event listener configured
        // Attack
        attack({testbed, signa: 100n})

        const events = getEventList(testbed)
        expect(events.length).toBe(0);
    })

    test("should NOT send events to the listener when listener is the sender", async () => {
        const testbed = new SimulatorTestbed(BootstrapScenario)
            .loadContract(Context.ContractPath, DefaultRequiredInitializers)
            .runScenario();

        // Set event listener to the account that will attack
        testbed.sendTransactionAndGetResponse([{
            sender: Context.CreatorAccount,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetEventListener, EventListenerAccount],
        }])

        // Attack from the listener account
        attack({testbed, signa: 100n, sender: EventListenerAccount})

        const events = getEventList(testbed);
        const numberOfEventsSent = events.length;
        // Should not have received hit event (listener is sender)
        expect(numberOfEventsSent).toBe(0);
    })
})
