import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharRegistry,
    deployCharacterOnRegistry,
    deployCharacterWithCharRegistry,
    getCharRegistryValue,
    getCharState,
    sendAttack,
    sendSeppuku,
    sendRefund,
} from '../lib';

const CONSTRUCT_ID = 12345n;

describe('init() — registration at the character-account registry', () => {
    test('registers (creator, characterId) -> codehash on deploy, before any commitment', () => {
        const testbed = deployCharacterWithCharRegistry();
        const character = testbed.getContract(Context.CharacterAddress);

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(0n);
    });

    test('the per-creator counter increments with each new deploy', () => {
        const testbed = deployCharRegistry();
        deployCharacterOnRegistry(testbed, { address: 5001n });
        deployCharacterOnRegistry(testbed, { address: 5002n });

        expect(getCharRegistryValue(testbed, Context.OwnerAccount, 0n)).toBe(2n);
    });

    test('a 6th deployed character (over the 5-slot cap) is silently dropped from the registry', () => {
        const testbed = deployCharRegistry();
        for (let i = 0; i < 6; i++) {
            deployCharacterOnRegistry(testbed, { address: 6001n + BigInt(i) });
        }

        // 5 registered (6001..6005), counter capped at 5, the 6th (6006) unregistered.
        expect(getCharRegistryValue(testbed, Context.OwnerAccount, 0n)).toBe(5n);
        expect(getCharRegistryValue(testbed, Context.OwnerAccount, 6006n)).toBe(0n);
    });
});

describe('seppuku()', () => {
    test('is a no-op before commitment — no unregister, no death', () => {
        const testbed = deployCharacterWithCharRegistry();
        const character = testbed.getContract(Context.CharacterAddress);

        sendSeppuku(testbed);

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(0n);
    });

    test('after commitment, unregisters the character and kills it — no SIGNA or assets sent back', () => {
        const testbed = deployCharacterWithCharRegistry();
        const character = testbed.getContract(Context.CharacterAddress);
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(1n);
        const ownerBefore = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;

        sendSeppuku(testbed);

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(0n);
        expect(getCharRegistryValue(testbed, character.creator, 0n)).toBe(0n); // slot freed
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(1n);
        const ownerAfter = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;
        expect(ownerAfter).toBeLessThanOrEqual(ownerBefore); // nothing refunded by seppuku itself
    });

    test('ignores seppuku from a non-creator sender', () => {
        const testbed = deployCharacterWithCharRegistry();
        const character = testbed.getContract(Context.CharacterAddress);
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });

        sendSeppuku(testbed, { sender: 424242n });

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
    });
});

describe('refund() — independent of registration and commitment', () => {
    test('still works after seppuku — the balance stays available since seppuku never touches it', () => {
        const testbed = deployCharacterWithCharRegistry();
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        sendSeppuku(testbed);
        const ownerBefore = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;

        sendRefund(testbed);

        const ownerAfter = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;
        expect(ownerAfter).toBeGreaterThan(ownerBefore);
    });

    test('works normally while committed', () => {
        const testbed = deployCharacterWithCharRegistry();
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        const ownerBefore = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;

        sendRefund(testbed);

        const ownerAfter = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;
        expect(ownerAfter).toBeGreaterThan(ownerBefore);
    });
});
