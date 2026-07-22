import { describe, expect, test } from 'vitest';
import type { SimulatorTestbed } from 'signum-smartc-testbed';
import { Context } from '../context';
import {
    deployCharRegistry,
    deployCharacterOnRegistry,
    deployCharacterWithCharRegistry,
    deployCharacterWithRegistries,
    getCharRegistryValue,
    getCharState,
    sendAttack,
    sendSeppuku,
    sendRefund,
    sendReceiveAttack,
} from '../lib';

const CONSTRUCT_ID = 12345n;

// SEPPUKU now requires isDead == TRUE at dispatch, so exercising it needs a
// real death. Damage mitigation (armor/dodge) means one maxHp hit no longer
// reliably kills, so overwhelm armor and retry past dodges until dead.
function killCharacter(testbed: SimulatorTestbed, constructAddress: bigint) {
    for (let i = 0; i < 64; i++) {
        if (getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress) === 1n) return;
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);
        sendReceiveAttack(testbed, { sender: constructAddress, rawDamage: maxHp * 4n });
    }
    throw new Error('killCharacter: character never died');
}

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
    test('is a no-op while alive, even after committing — SEPPUKU is blocked at dispatch until isDead == TRUE', () => {
        const testbed = deployCharacterWithCharRegistry();
        const character = testbed.getContract(Context.CharacterAddress);
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(1n);

        sendSeppuku(testbed);

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(0n);
    });

    test('is a no-op while dead but never committed — no unregister', () => {
        const { testbed, constructAddress } = deployCharacterWithRegistries();
        const character = testbed.getContract(Context.CharacterAddress);
        killCharacter(testbed, constructAddress);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(1n);
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(0n);

        sendSeppuku(testbed);

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
    });

    test('once committed and dead, unregisters the character — no SIGNA or assets sent back', () => {
        const { testbed, constructAddress } = deployCharacterWithRegistries();
        const character = testbed.getContract(Context.CharacterAddress);
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        killCharacter(testbed, constructAddress);
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(1n);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(1n);
        const ownerBefore = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;

        sendSeppuku(testbed);

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(0n);
        expect(getCharRegistryValue(testbed, character.creator, 0n)).toBe(0n); // slot freed
        const ownerAfter = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;
        expect(ownerAfter).toBeLessThanOrEqual(ownerBefore); // nothing refunded by seppuku itself
    });

    test('ignores seppuku from a non-creator sender', () => {
        const { testbed, constructAddress } = deployCharacterWithRegistries();
        const character = testbed.getContract(Context.CharacterAddress);
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        killCharacter(testbed, constructAddress);

        sendSeppuku(testbed, { sender: 424242n });

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
    });

    test('a repeated seppuku on an already-retired character does not re-send the unregister (no fee drain)', () => {
        const { testbed, constructAddress } = deployCharacterWithRegistries();
        const character = testbed.getContract(Context.CharacterAddress);
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        killCharacter(testbed, constructAddress);

        // First seppuku unregisters the character.
        sendSeppuku(testbed);
        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(0n);

        // Count messages the character has sent to the registry so far (one REGISTER
        // at init + one UNREGISTER from the first seppuku).
        const registryTxCount = () => testbed.getTransactions().filter(
            (tx: any) => tx.sender === Context.CharacterAddress && tx.recipient === Context.CharRegistryAddress).length;
        const before = registryTxCount();

        // A second seppuku (still isDead && committed) must NOT re-send the unregister.
        sendSeppuku(testbed);

        expect(registryTxCount()).toBe(before);
        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(0n);
    });
});

describe('refund() — independent of registration and commitment', () => {
    test('still works after seppuku — the balance stays available since seppuku never touches it', () => {
        const { testbed, constructAddress } = deployCharacterWithRegistries();
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        killCharacter(testbed, constructAddress);
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
