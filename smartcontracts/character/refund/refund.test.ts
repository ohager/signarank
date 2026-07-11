import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import { deployCharacter, sendRefund, fundCharacterWithToken } from '../lib';

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

    test('with an assetId, sends the full balance of that token instead of SIGNA', () => {
        const testbed = deployCharacter();
        const ITEM_ID = 55555n;
        // Funded from an unrelated account (e.g. a drop from combat), not the
        // owner — otherwise the testbed's own account would go negative from
        // "sending" a token it never held, muddying the refund assertion below.
        fundCharacterWithToken(testbed, { sender: 777777n, tokenId: ITEM_ID, quantity: 7n });

        sendRefund(testbed, { assetId: ITEM_ID });

        const owner = testbed.getAccount(Context.OwnerAccount);
        expect(owner?.tokens?.find(t => t.asset === ITEM_ID)?.quantity).toBe(7n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === ITEM_ID)?.quantity ?? 0n).toBe(0n);
        // An asset-scoped refund doesn't touch SIGNA — the contract's balance
        // (from BootstrapScenario + accumulated activation fees) is untouched.
        expect(testbed.getAccount(Context.CharacterAddress)?.balance ?? 0n).toBeGreaterThan(0n);
    });

    test('with an assetId the character does not hold, sends nothing', () => {
        const testbed = deployCharacter();
        const UNHELD_ITEM_ID = 99999n;

        sendRefund(testbed, { assetId: UNHELD_ITEM_ID });

        const owner = testbed.getAccount(Context.OwnerAccount);
        expect(owner?.tokens?.find(t => t.asset === UNHELD_ITEM_ID)).toBeUndefined();
    });
});
