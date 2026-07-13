import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import { deployCharacter, sendRefund, getCharState } from '../lib';

const CONSTRUCT_ID = 12345n;

describe('refund()', () => {
    test('sends the contract SIGNA balance to the creator', () => {
        const testbed = deployCharacter();
        const ownerBefore = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;

        sendRefund(testbed);

        const ownerAfter = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;
        // BootstrapScenario funds the contract with 200 SIGNA; most of it should
        // come back (minus activation fees already spent on prior activations).
        expect(ownerAfter - ownerBefore).toBeGreaterThan(190n * 1_0000_0000n);
    });

    test('leaves the contract near-zero balance afterwards', () => {
        const testbed = deployCharacter();
        sendRefund(testbed);

        const character = testbed.getAccount(Context.CharacterAddress);
        expect(character?.balance ?? 0n).toBeLessThan(2n * 1_0000_0000n);
    });

    test('ignores calls from a non-creator sender', () => {
        const testbed = deployCharacter();
        const ownerBefore = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;

        sendRefund(testbed, { sender: 555555n });

        const ownerAfter = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;
        expect(ownerAfter).toBe(ownerBefore);
    });

    // Finding 4: an in-loop refund used to drain the balance before a same-block
    // ATTACK's forward, freezing the contract mid-send. Refund now runs AFTER the
    // tx loop, so the attack forwards with balance intact and refund takes the rest.
    test('a REFUND in the same block as an ATTACK does not strand the attack — it forwards, then the remainder is refunded', () => {
        const testbed = deployCharacter();
        const forwarded = 10n * 1_0000_0000n;

        testbed.sendTransactionAndGetResponse([
            { sender: Context.OwnerAccount, recipient: Context.CharacterAddress, amount: Context.ActivationFee, messageArr: [Context.Methods.Refund, 0n, 0n, 0n] },
            { sender: Context.OwnerAccount, recipient: Context.CharacterAddress, amount: Context.ActivationFee + forwarded, messageArr: [Context.Methods.Attack, CONSTRUCT_ID, 0n, 0n] },
        ], Context.CharacterAddress);

        // The attack forwarded its SIGNA (not stranded/frozen by the refund)...
        expect(testbed.getAccount(CONSTRUCT_ID)?.balance ?? 0n).toBe(forwarded);
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(1n);
        // ...and the leftover balance was refunded, leaving the contract drained (not frozen).
        expect(testbed.getAccount(Context.CharacterAddress)?.balance ?? 0n).toBeLessThan(2n * 1_0000_0000n);
    });
});
