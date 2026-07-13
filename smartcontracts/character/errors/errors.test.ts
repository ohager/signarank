import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharacter,
    deployCharacterWithGamemasterRegistry,
    deployCharacterWithTrustedConstruct,
    getCharState,
    sendAttack,
    sendReroll,
    sendTransferItem,
    sendUseItem,
    sendAllocateSkillpoint,
    sendDeductHitpoints,
    fundCharacterWithToken,
    killCharacter,
    registerItemOnGamemasterRegistry,
    registerEffectOnGamemasterRegistry,
    setItemEffectOnGamemasterRegistry,
    getErrorCount,
    getLastError,
    getErrorCodeAtSlot,
    findErrorMessageToOwner,
} from '../lib';

const CONSTRUCT_ID = 12345n;
const RING_ID = 5001n;
const HEAL_POTION_ID = 5002n;
const EOA_RECIPIENT = 424242n;
const NON_OWNER = 777777n;

describe('rolling error log — each owner-action failure records a code', () => {
    test('attack with no SIGNA → ERR_ATTACK_NOT_POSSIBLE', () => {
        const testbed = deployCharacter();

        sendAttack(testbed, { signa: 0n, constructId: CONSTRUCT_ID });

        expect(getLastError(testbed)?.code).toBe(Context.Errors.AttackNotPossible);
    });

    test('reroll while committed → ERR_REROLL_COMMITTED', () => {
        const testbed = deployCharacter();
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID }); // commits, no error
        expect(getErrorCount(testbed)).toBe(0n);

        sendReroll(testbed, { signa: 100_0000_0000n });

        expect(getLastError(testbed)?.code).toBe(Context.Errors.RerollCommitted);
    });

    test('reroll past MAX_REROLLS → ERR_REROLL_MAX_REACHED', () => {
        const testbed = deployCharacter();
        for (let i = 0; i < 5; i++) {
            sendReroll(testbed, { signa: 100_0000_0000n }); // keep balance above the cost
        }
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(5n);
        expect(getErrorCount(testbed)).toBe(0n); // 5 clean rerolls

        sendReroll(testbed, { signa: 100_0000_0000n });

        expect(getLastError(testbed)?.code).toBe(Context.Errors.RerollMaxReached);
    });

    test('reroll with the balance below the cost → ERR_REROLL_INSUFFICIENT', () => {
        const testbed = deployCharacter();
        // Drain below REROLL_COSTS with two zero-attached rerolls.
        sendReroll(testbed, { signa: 0n });
        sendReroll(testbed, { signa: 0n });
        expect(getErrorCount(testbed)).toBe(0n);

        sendReroll(testbed, { signa: 0n });

        expect(getLastError(testbed)?.code).toBe(Context.Errors.RerollInsufficient);
    });

    test('transfer to a contract recipient → ERR_TRANSFER_TO_CONTRACT', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 10n, effectCount: 0n });
        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n });

        sendTransferItem(testbed, { itemId: RING_ID, recipientId: Context.GamemasterRegistryAddress });

        expect(getLastError(testbed)?.code).toBe(Context.Errors.TransferToContract);
    });

    test('transfer of an item the character does not hold → ERR_TRANSFER_ITEM_NOT_HELD', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 10n, effectCount: 0n });

        sendTransferItem(testbed, { itemId: RING_ID, recipientId: EOA_RECIPIENT });

        expect(getLastError(testbed)?.code).toBe(Context.Errors.TransferItemNotHeld);
    });

    test('use of an item the character does not hold → ERR_USE_ITEM_NOT_HELD', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 0n });

        sendUseItem(testbed, { tokenId: HEAL_POTION_ID });

        expect(getLastError(testbed)?.code).toBe(Context.Errors.UseItemNotHeld);
    });

    test('use of a non-consumable (equipment) → ERR_USE_ITEM_NOT_CONSUMABLE', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 10n, effectCount: 0n });
        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n });

        sendUseItem(testbed, { tokenId: RING_ID });

        expect(getLastError(testbed)?.code).toBe(Context.Errors.UseItemNotConsumable);
    });

    test('depositing 2+ items in one tx → ERR_DEPOSIT_AMBIGUOUS', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 0n });

        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount,
            recipient: Context.CharacterAddress,
            amount: Context.ActivationFee,
            tokens: [{ asset: RING_ID, quantity: 1n }, { asset: HEAL_POTION_ID, quantity: 1n }],
            messageArr: [0n, 0n, 0n, 0n],
        }], Context.CharacterAddress);

        expect(getLastError(testbed)?.code).toBe(Context.Errors.DepositAmbiguous);
    });

    test('a deposit that would exceed the inventory limit → ERR_INVENTORY_FULL', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        const maxSlots = getCharState(testbed, Context.Vars.MaxInventorySlots);
        // Consumables stack, so a single deposit can fill every slot — equipment
        // is one-per-slot and would be bounced as a multi-unit deposit.
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: maxSlots + 1n, effectCount: 0n });
        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: maxSlots }); // fills inventory, no error
        expect(getErrorCount(testbed)).toBe(0n);

        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: 1n });

        expect(getLastError(testbed)?.code).toBe(Context.Errors.InventoryFull);
    });

    test('allocating with no skill points → ERR_ALLOC_NO_SKILLPOINTS', () => {
        const testbed = deployCharacter(); // init() spends all 5 starting points → skillPoints == 0
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(0n);

        sendAllocateSkillpoint(testbed, Context.Attrs.Strength);

        expect(getLastError(testbed)?.code).toBe(Context.Errors.AllocNoSkillpoints);
    });

    test('allocating to an out-of-range attribute → ERR_ALLOC_INVALID_ATTRIBUTE', () => {
        const testbed = deployCharacter();

        sendAllocateSkillpoint(testbed, 6n); // valid range is 1..5

        expect(getLastError(testbed)?.code).toBe(Context.Errors.AllocInvalidAttribute);
    });

    test('depositing an unregistered token → ERR_ITEM_NOT_REGISTERED', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n }); // RING never registered here

        expect(getLastError(testbed)?.code).toBe(Context.Errors.ItemNotRegistered);
    });

    test('depositing an item above the character level → ERR_ITEM_LEVEL_TOO_LOW', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, minLevel: 5n, effectCount: 0n });

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n }); // level 1 < minLevel 5

        expect(getLastError(testbed)?.code).toBe(Context.Errors.ItemLevelTooLow);
    });

    test('a deposit beyond the item stack limit → ERR_ITEM_STACK_LIMIT', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });
        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n }); // accepted, no error
        expect(getErrorCount(testbed)).toBe(0n);

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n }); // would hold 2 > stackLimit 1

        expect(getLastError(testbed)?.code).toBe(Context.Errors.ItemStackLimit);
    });

    test('using a consumable whose effect precondition fails → ERR_USE_ITEM_NO_EFFECT', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 10n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Heal, bonusAbs: 100n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, slot: 0n, logicalEffectId: 10n });
        killCharacter(testbed, constructAddress); // dead ⇒ HEAL can't fire
        // Deposit AFTER death so the death item-drop can't remove the potion this test relies on.
        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: 1n });

        sendUseItem(testbed, { tokenId: HEAL_POTION_ID, characterAddress: Context.CharacterAddress });

        expect(getLastError(testbed, Context.CharacterAddress)?.code).toBe(Context.Errors.UseItemNoEffect);
    });

    test('a death-gated action attempted while dead → ERR_CHARACTER_DEAD (special code 66)', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        killCharacter(testbed, constructAddress);
        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);

        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });

        expect(getLastError(testbed, Context.CharacterAddress)?.code).toBe(Context.Errors.CharacterDead);
        const msg = findErrorMessageToOwner(testbed, Context.Errors.CharacterDead);
        expect(msg?.messageText).toBe('ERROR Code: 66');
    });
});

describe('rolling error log — bookkeeping', () => {
    test('a failure by a non-owner is never logged (the window cannot be flooded)', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 10n, effectCount: 0n });

        // A stranger's registered item is bounced by the owner-gate — but not logged.
        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n, sender: NON_OWNER });

        expect(getErrorCount(testbed)).toBe(0n);
    });

    test('the failure pushes a human-readable "ERROR Code: <code>" message to the owner', () => {
        const testbed = deployCharacter();

        sendAttack(testbed, { signa: 0n, constructId: CONSTRUCT_ID });

        const msg = findErrorMessageToOwner(testbed, Context.Errors.AttackNotPossible);
        expect(msg?.messageText).toBe('ERROR Code: 1');
    });

    test('a two-digit code renders correctly in the owner message', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        const maxSlots = getCharState(testbed, Context.Vars.MaxInventorySlots);
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: maxSlots + 1n, effectCount: 0n });
        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: maxSlots });

        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: 1n }); // inventory full = code 10

        expect(getLastError(testbed)?.code).toBe(Context.Errors.InventoryFull);
        const msg = findErrorMessageToOwner(testbed, Context.Errors.InventoryFull);
        expect(msg?.messageText).toBe('ERROR Code: 10');
    });

    test('the log is a ring buffer: the 51st entry overwrites slot 0, count keeps climbing', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();

        // Entry #1: a distinct code at slot 0 (attack has no registered item needs).
        sendAttack(testbed, { signa: 0n, constructId: CONSTRUCT_ID });
        expect(getErrorCodeAtSlot(testbed, 0n)).toBe(Context.Errors.AttackNotPossible);

        // Entries #2..#51: 50 transfer-to-contract errors (recipient is a contract,
        // so the not-held check is never reached — no funding required).
        for (let i = 0; i < 50; i++) {
            sendTransferItem(testbed, { itemId: RING_ID, recipientId: Context.GamemasterRegistryAddress });
        }

        expect(getErrorCount(testbed)).toBe(51n);
        // #51 wrapped back to slot 0, overwriting the original attack error.
        expect(getErrorCodeAtSlot(testbed, 0n)).toBe(Context.Errors.TransferToContract);
        expect(getLastError(testbed)?.code).toBe(Context.Errors.TransferToContract);
    });
});
