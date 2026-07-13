import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharacterWithGamemasterRegistry,
    getCharState,
    sendTransferItem,
    registerItemOnGamemasterRegistry,
    fundCharacterWithToken,
    fundCharacterWithXp,
    getLastError,
} from '../lib';

const ITEM_ID = 55555n;
const RECIPIENT = 424242n;

// receiveAssets() only accepts tokens registered as items on the gamemaster
// registry (see items/items.test.ts) — an unregistered token never lands in
// inventory at all, so transferItem() needs a real registered item to move.
function deployWithRegisteredItem() {
    const { testbed } = deployCharacterWithGamemasterRegistry();
    registerItemOnGamemasterRegistry(testbed, { tokenId: ITEM_ID, itemType: Context.ItemType.Equipment, stackLimit: 10n, effectCount: 0n });
    return testbed;
}

// Equipment is one-per-slot: a multi-unit deposit is bounced, so hold several
// by depositing them one unit at a time.
function fundSingleUnits(testbed: ReturnType<typeof deployWithRegisteredItem>, count: number) {
    for (let i = 0; i < count; i++) {
        fundCharacterWithToken(testbed, { tokenId: ITEM_ID, quantity: 1n });
    }
}

describe('transferItem()', () => {
    test('sends exactly 1 unit of the held item to the recipient', () => {
        const testbed = deployWithRegisteredItem();
        fundSingleUnits(testbed, 3);

        sendTransferItem(testbed, { itemId: ITEM_ID, recipientId: RECIPIENT });

        const recipient = testbed.getAccount(RECIPIENT);
        expect(recipient?.tokens?.find(t => t.asset === ITEM_ID)?.quantity).toBe(1n);
    });

    test('decrements usedInventorySlots by exactly 1 for a tracked Equipment item', () => {
        const testbed = deployWithRegisteredItem();
        fundSingleUnits(testbed, 3);
        const before = getCharState(testbed, Context.Vars.UsedInventorySlots);

        sendTransferItem(testbed, { itemId: ITEM_ID, recipientId: RECIPIENT });

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(before - 1n);
    });

    test('sending when the character holds none of the item is a silent no-op', () => {
        const testbed = deployWithRegisteredItem();
        sendTransferItem(testbed, { itemId: ITEM_ID, recipientId: RECIPIENT });

        const recipient = testbed.getAccount(RECIPIENT);
        expect(recipient?.tokens?.find(t => t.asset === ITEM_ID)?.quantity ?? 0n).toBe(0n);
    });

    test('ignores calls from a non-creator sender', () => {
        const testbed = deployWithRegisteredItem();
        fundSingleUnits(testbed, 3);

        sendTransferItem(testbed, { itemId: ITEM_ID, recipientId: RECIPIENT, sender: 777777n });

        const recipient = testbed.getAccount(RECIPIENT);
        expect(recipient?.tokens?.find(t => t.asset === ITEM_ID)?.quantity ?? 0n).toBe(0n);
    });

    test('refuses to transfer to a contract recipient — EOA accounts only, no slot freed', () => {
        const testbed = deployWithRegisteredItem();
        fundCharacterWithToken(testbed, { tokenId: ITEM_ID, quantity: 1n });
        const slotsBefore = getCharState(testbed, Context.Vars.UsedInventorySlots);

        // The gamemaster registry is a deployed contract — stands in for "any
        // contract recipient", including another character.
        sendTransferItem(testbed, { itemId: ITEM_ID, recipientId: Context.GamemasterRegistryAddress });

        // Rejected outright: nothing sent, slot not freed, item still held.
        const recipient = testbed.getAccount(Context.GamemasterRegistryAddress);
        expect(recipient?.tokens?.find(t => t.asset === ITEM_ID)?.quantity ?? 0n).toBe(0n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(slotsBefore);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === ITEM_ID)?.quantity ?? 0n).toBe(1n);
    });

    test('refuses to transfer the XP token out — a character never loses its XP', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        fundCharacterWithXp(testbed, { quantity: 500n });
        const heldBefore = testbed.getContract(Context.CharacterAddress).tokens.find(t => t.asset === Context.XpTokenId)?.quantity ?? 0n;
        expect(heldBefore).toBe(500n);

        // XP is a permanent, one-way progression commitment — it can never leave
        // the character (the sole guard against recycling XP to level another).
        sendTransferItem(testbed, { itemId: Context.XpTokenId, recipientId: RECIPIENT });

        const heldAfter = testbed.getContract(Context.CharacterAddress).tokens.find(t => t.asset === Context.XpTokenId)?.quantity ?? 0n;
        expect(heldAfter).toBe(500n);
        expect(testbed.getAccount(RECIPIENT)?.tokens?.find(t => t.asset === Context.XpTokenId)?.quantity ?? 0n).toBe(0n);
        expect(getLastError(testbed)?.code).toBe(Context.Errors.TransferXp);
    });
});
