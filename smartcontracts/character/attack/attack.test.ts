import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import { deployCharacter, deployCharacterWithTrustedConstruct, sendAttack, sendDeductHitpoints, getCharState } from '../lib';

const CONSTRUCT_ID = 12345n;

describe('attack()', () => {
    test('forwards the attached SIGNA to the given constructId', () => {
        const testbed = deployCharacter();
        sendAttack(testbed, { signa: 100n, constructId: CONSTRUCT_ID });

        const construct = testbed.getAccount(CONSTRUCT_ID);
        expect(construct?.balance).toBe(100n * 1_0000_0000n);
    });

    test('with quantity 0 (default), no token transfer is attempted — only SIGNA moves', () => {
        const testbed = deployCharacter();
        sendAttack(testbed, { signa: 50n, constructId: CONSTRUCT_ID });

        const construct = testbed.getAccount(CONSTRUCT_ID);
        expect(construct?.balance).toBe(50n * 1_0000_0000n);
        expect(construct?.tokens ?? []).toHaveLength(0);
    });

    test('ignores attack from a non-creator sender — no SIGNA forwarded', () => {
        const testbed = deployCharacter();
        sendAttack(testbed, { signa: 100n, constructId: CONSTRUCT_ID, sender: 424242n });

        const construct = testbed.getAccount(CONSTRUCT_ID);
        expect(construct?.balance ?? 0n).toBe(0n);
    });

    test('refunds the attached SIGNA to the owner instead of attacking while dead', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);
        sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: maxHp + 1n });
        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);

        sendAttack(testbed, { signa: 100n, constructId: CONSTRUCT_ID });

        const construct = testbed.getAccount(CONSTRUCT_ID);
        expect(construct?.balance ?? 0n).toBe(0n);
        const refundTx = testbed.getTransactions().find(tx =>
            tx.sender === Context.CharacterAddress && tx.recipient === Context.OwnerAccount,
        );
        expect(refundTx?.amount).toBe(100n * 1_0000_0000n);
    });
});
