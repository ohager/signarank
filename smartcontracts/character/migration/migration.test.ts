import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharacter,
    deployCharacterWithCharRegistry,
    setNextCharacterHashOnGamemasterRegistry,
    sendMigrate,
    fundCharacterWithXp,
    fundCharacterWithToken,
    registerItemOnGamemasterRegistry,
    sendAllocateSkillpoint,
    getCharState,
    getPublicLevel,
    getPublicSkillPoints,
    tokensSentTo,
    getLastError,
    getCharRegistryValue,
} from '../lib';

const NEXT_HASH = 0xC0FFEEn; // any non-zero value opens the migration window

// Level and skill points are memory-only working state; publishProgression()
// mirrors them into a cross-contract-readable map every activation so the dApp
// and a future v2 (pull-migration) can read the full character sheet.
describe('publishProgression() — public character sheet', () => {
    test('publishes level 1 and zero unspent skill points at deploy', () => {
        const testbed = deployCharacter();
        expect(getPublicLevel(testbed)).toBe(1n);
        expect(getPublicSkillPoints(testbed)).toBe(0n);
    });

    test('mirrors level and skill points through a level-up and a subsequent allocation', () => {
        const testbed = deployCharacter();

        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase }); // reach level 2 → +1 skill point
        expect(getPublicLevel(testbed)).toBe(2n);
        expect(getPublicSkillPoints(testbed)).toBe(1n);
        // the public sheet must agree with the memory state it mirrors
        expect(getPublicLevel(testbed)).toBe(getCharState(testbed, Context.Vars.Level));

        sendAllocateSkillpoint(testbed, Context.Attrs.Strength);
        expect(getPublicSkillPoints(testbed)).toBe(0n);
        expect(getPublicLevel(testbed)).toBe(2n);
    });
});

describe('migrate() — one-shot liquidation to owner', () => {
    test('is rejected while no migration window is open — nothing liquidated, error logged', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: 500n });

        sendMigrate(testbed);

        expect(getCharState(testbed, Context.Vars.Migrated)).toBe(0n);
        expect(getLastError(testbed)?.code).toBe(Context.Errors.MigrateDisabled);
        // XP stays on the character — it was not sent to the owner
        expect(tokensSentTo(testbed, Context.OwnerAccount, Context.XpTokenId)).toBe(0n);
    });
    test('liquidates all XP to the owner and marks the character migrated', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: 1500n });
        setNextCharacterHashOnGamemasterRegistry(testbed, NEXT_HASH);

        sendMigrate(testbed);

        expect(getCharState(testbed, Context.Vars.Migrated)).toBe(1n);
        expect(tokensSentTo(testbed, Context.OwnerAccount, Context.XpTokenId)).toBe(1500n);
        // character no longer holds the XP
        const held = testbed.getContract(Context.CharacterAddress).tokens.find(t => t.asset === Context.XpTokenId);
        expect(held?.quantity ?? 0n).toBe(0n);
    });

    test('liquidates inventory items to the owner', () => {
        const testbed = deployCharacter();
        registerItemOnGamemasterRegistry(testbed, { tokenId: 4001n, itemType: Context.ItemType.Consumable });
        fundCharacterWithToken(testbed, { tokenId: 4001n, quantity: 3n });
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(3n);
        setNextCharacterHashOnGamemasterRegistry(testbed, NEXT_HASH);

        sendMigrate(testbed);

        expect(tokensSentTo(testbed, Context.OwnerAccount, 4001n)).toBe(3n);
    });

    test('liquidates the SIGNA balance to the owner and drains the character', () => {
        const testbed = deployCharacter();
        setNextCharacterHashOnGamemasterRegistry(testbed, NEXT_HASH);
        const ownerBefore = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;

        sendMigrate(testbed);

        const ownerAfter = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;
        expect(ownerAfter).toBeGreaterThan(ownerBefore);
        expect(testbed.getAccount(Context.CharacterAddress)?.balance ?? 0n).toBeLessThan(2n * 1_0000_0000n);
    });

    test('once migrated the character is inert — a later deposit bounces back, no state change', () => {
        const testbed = deployCharacter();
        registerItemOnGamemasterRegistry(testbed, { tokenId: 4002n, itemType: Context.ItemType.Consumable });
        setNextCharacterHashOnGamemasterRegistry(testbed, NEXT_HASH);
        sendMigrate(testbed);
        expect(getCharState(testbed, Context.Vars.Migrated)).toBe(1n);

        const stranger = 314159n;
        fundCharacterWithToken(testbed, { sender: stranger, tokenId: 4002n, quantity: 2n });

        // nothing entered inventory; the item was returned to the sender
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        expect(tokensSentTo(testbed, stranger, 4002n)).toBe(2n);
    });

    test('is one-shot — a second MIGRATE is a silent no-op', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: 1000n });
        setNextCharacterHashOnGamemasterRegistry(testbed, NEXT_HASH);
        sendMigrate(testbed);
        const errorsAfterFirst = getCharState(testbed, Context.Vars.ErrorCount);

        sendMigrate(testbed);

        expect(getCharState(testbed, Context.Vars.Migrated)).toBe(1n);
        // no new XP moved (already gone) and no error logged by the second call
        expect(getCharState(testbed, Context.Vars.ErrorCount)).toBe(errorsAfterFirst);
    });

    test('ignores MIGRATE from a non-creator sender', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: 1000n });
        setNextCharacterHashOnGamemasterRegistry(testbed, NEXT_HASH);

        sendMigrate(testbed, { sender: 424242n });

        expect(getCharState(testbed, Context.Vars.Migrated)).toBe(0n);
        expect(tokensSentTo(testbed, Context.OwnerAccount, Context.XpTokenId)).toBe(0n);
    });

    test('unregisters the character from the character-account registry', () => {
        const testbed = deployCharacterWithCharRegistry();
        const character = testbed.getContract(Context.CharacterAddress);
        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
        setNextCharacterHashOnGamemasterRegistry(testbed, NEXT_HASH);

        sendMigrate(testbed);

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(0n);
    });
});
