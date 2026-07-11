import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import { deployCharacter, getCharState, sendTransferItem } from '../lib';

const ITEM_ID = 55555n;
const RECIPIENT = 424242n;

function fundCharacterWithToken(testbed: ReturnType<typeof deployCharacter>, assetId: bigint, quantity: bigint) {
    // Tokens attached to any incoming tx are credited to the recipient's balance
    // regardless of whether the contract's message handling recognizes the tx —
    // the character contract has no explicit asset-receipt logic at all.
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.CharacterAddress,
        amount: Context.ActivationFee,
        tokens: [{ asset: assetId, quantity }],
    }], Context.CharacterAddress);
}

describe('transferItem()', () => {
    test('sends exactly 1 unit of the held item to the recipient', () => {
        const testbed = deployCharacter();
        fundCharacterWithToken(testbed, ITEM_ID, 3n);

        sendTransferItem(testbed, { itemId: ITEM_ID, recipientId: RECIPIENT });

        const recipient = testbed.getAccount(RECIPIENT);
        expect(recipient?.tokens?.find(t => t.asset === ITEM_ID)?.quantity).toBe(1n);
    });

    // KNOWN GAP: usedInventorySlots is never decremented on transfer-out (in fact
    // nothing in the current contract ever increments it either — see
    // lifecycle/init.test.ts, it's permanently stuck at 0 post-deploy).
    test('does not adjust usedInventorySlots — the counter is not wired to token movement', () => {
        const testbed = deployCharacter();
        fundCharacterWithToken(testbed, ITEM_ID, 1n);
        const before = getCharState(testbed, Context.Vars.UsedInventorySlots);

        sendTransferItem(testbed, { itemId: ITEM_ID, recipientId: RECIPIENT });

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(before);
    });

    test('sending when the character holds none of the item is a silent no-op', () => {
        const testbed = deployCharacter();
        sendTransferItem(testbed, { itemId: ITEM_ID, recipientId: RECIPIENT });

        const recipient = testbed.getAccount(RECIPIENT);
        expect(recipient?.tokens?.find(t => t.asset === ITEM_ID)?.quantity ?? 0n).toBe(0n);
    });

    test('ignores calls from a non-creator sender', () => {
        const testbed = deployCharacter();
        fundCharacterWithToken(testbed, ITEM_ID, 3n);

        sendTransferItem(testbed, { itemId: ITEM_ID, recipientId: RECIPIENT, sender: 777777n });

        const recipient = testbed.getAccount(RECIPIENT);
        expect(recipient?.tokens?.find(t => t.asset === ITEM_ID)?.quantity ?? 0n).toBe(0n);
    });
});
