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

// Kills the character via a trusted construct's RECEIVE_ATTACK — used only by
// the "already dead" seppuku no-op test below. Damage mitigation (armor/dodge)
// means one maxHp hit no longer reliably kills, so overwhelm armor and retry
// past dodges until dead.
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
    test('is a no-op before ever committing (no ATTACK sent yet)', () => {
        const testbed = deployCharacterWithCharRegistry();
        const character = testbed.getContract(Context.CharacterAddress);
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(0n);

        sendSeppuku(testbed);

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(0n);
    });

    test('once committed and alive, kills the character (via the normal death penalty) and unregisters — no SIGNA or assets sent back', () => {
        const testbed = deployCharacterWithCharRegistry();
        const character = testbed.getContract(Context.CharacterAddress);
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(1n);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(0n);
        const ownerBefore = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;

        sendSeppuku(testbed);

        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(1n);
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints)).toBe(0n);
        // main()'s post-loop check fires the normal handleDead() penalty on a
        // seppuku death exactly like any other death.
        expect(getCharState(testbed, Context.Vars.DeathPenaltyApplied)).toBe(1n);
        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(0n);
        expect(getCharRegistryValue(testbed, character.creator, 0n)).toBe(0n); // slot freed
        const ownerAfter = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;
        expect(ownerAfter).toBeLessThanOrEqual(ownerBefore); // nothing refunded by seppuku itself
    });

    test('is a no-op if already dead (e.g. died in combat), even though committed', () => {
        const { testbed, constructAddress } = deployCharacterWithRegistries();
        const character = testbed.getContract(Context.CharacterAddress);
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        killCharacter(testbed, constructAddress);
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(1n);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(1n);

        sendSeppuku(testbed);

        // Still registered — SEPPUKU never reached unregisterFromCharRegistry().
        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
    });

    test('ignores seppuku from a non-creator sender', () => {
        const testbed = deployCharacterWithCharRegistry();
        const character = testbed.getContract(Context.CharacterAddress);
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });

        sendSeppuku(testbed, { sender: 424242n });

        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(character.codeHashId);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(0n);
    });

    test('a second seppuku after the character is already dead does not re-send the unregister (blocked at dispatch)', () => {
        const testbed = deployCharacterWithCharRegistry();
        const character = testbed.getContract(Context.CharacterAddress);
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });

        // First seppuku kills the character and unregisters it.
        sendSeppuku(testbed);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(1n);
        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(0n);

        // Count messages the character has sent to the registry so far (one REGISTER
        // at init + one UNREGISTER from the first seppuku).
        const registryTxCount = () => testbed.getTransactions().filter(
            (tx: any) => tx.sender === Context.CharacterAddress && tx.recipient === Context.CharRegistryAddress).length;
        const before = registryTxCount();

        // A second seppuku is now blocked at dispatch (isDead == FALSE fails) —
        // must NOT re-send the unregister.
        sendSeppuku(testbed);

        expect(registryTxCount()).toBe(before);
        expect(getCharRegistryValue(testbed, character.creator, character.contract)).toBe(0n);
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
