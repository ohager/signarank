import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharacterWithGamemasterRegistry,
    getCharState,
    getEquipBonusAbs,
    getLastError,
    registerItemOnGamemasterRegistry,
    registerEffectOnGamemasterRegistry,
    setItemEffectOnGamemasterRegistry,
    sendTransferItem,
    fundCharacterWithToken,
} from '../lib';

const RING_ID = 5001n;
const HEAL_POTION_ID = 5002n;

// QNT of `asset` the Character actually sent back to `recipient`, summed over
// every outgoing token transfer to that account (0n if it never refunded).
function refundedTo(testbed: ReturnType<typeof deployCharacterWithGamemasterRegistry>['testbed'], recipient: bigint, asset: bigint): bigint {
    return (testbed.getTransactions() as { sender: bigint; recipient: bigint; tokens?: { asset: bigint; quantity: bigint }[] }[])
        .filter(tx => tx.sender === Context.CharacterAddress && tx.recipient === recipient)
        .flatMap(tx => tx.tokens ?? [])
        .filter(tok => tok.asset === asset)
        .reduce((sum, tok) => sum + tok.quantity, 0n);
}

describe('transferItem() — a transferred-out Consumable frees its inventory slot', () => {
    test('transferring the only held Consumable out returns the slot to 0', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 0n });
        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: 1n });
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(1n);

        // Transfer it to the owner (an EOA) instead of using it. The slot it
        // occupied on arrival must be released, exactly as useItem() releases it.
        sendTransferItem(testbed, { itemId: HEAL_POTION_ID, recipientId: Context.OwnerAccount });

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === HEAL_POTION_ID)?.quantity ?? 0n).toBe(0n);
    });

    test('transferring one of several held Consumables frees exactly one slot', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 0n });
        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: 3n });
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(3n);

        sendTransferItem(testbed, { itemId: HEAL_POTION_ID, recipientId: Context.OwnerAccount });

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(2n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === HEAL_POTION_ID)?.quantity ?? 0n).toBe(2n);
    });
});

describe('receiveAsset() — Equipment is single-unit only', () => {
    test('a deposit of 2+ units of an Equipment item keeps exactly one and refunds the surplus', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        // stackLimit high enough that the surplus refund is the multi-unit trim,
        // not the stack-limit guard.
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 1n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.AggregateAbs, bonusAbs: 2n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: RING_ID, slot: 0n, logicalEffectId: 1n });

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 3n });

        // One unit is equipped (slot + effect for that single unit); the other two
        // are returned so the player sees only one stuck and learns the rule.
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(1n);
        expect(getEquipBonusAbs(testbed, Context.EffectTarget.Strength)).toBe(2n);
        expect(refundedTo(testbed, Context.OwnerAccount, RING_ID)).toBe(2n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
        expect(getLastError(testbed)?.code).toBe(Context.Errors.EquipMultiUnit);
    });

    test('the kept unit still respects stackLimit — a multi-unit deposit never exceeds it', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 3n });

        // Keeps one (within the limit of 1), refunds the other two.
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(1n);
        expect(refundedTo(testbed, Context.OwnerAccount, RING_ID)).toBe(2n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
    });

    test('a single-unit Equipment deposit is still accepted and equipped', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 1n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.AggregateAbs, bonusAbs: 2n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: RING_ID, slot: 0n, logicalEffectId: 1n });

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n });

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(1n);
        expect(getEquipBonusAbs(testbed, Context.EffectTarget.Strength)).toBe(2n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
    });

    test('two separate single-unit Equipment deposits both stack normally', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 1n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.AggregateAbs, bonusAbs: 2n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: RING_ID, slot: 0n, logicalEffectId: 1n });

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n });
        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n });

        // One slot + one effect application per single-unit deposit — symmetric
        // with transferItem(), which removes one of each per call.
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(2n);
        expect(getEquipBonusAbs(testbed, Context.EffectTarget.Strength)).toBe(4n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(2n);
    });
});
