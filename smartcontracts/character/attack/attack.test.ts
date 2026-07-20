import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import { deployCharacter, deployCharacterWithTrustedConstruct, sendAttack, getCharState, getLastError, killCharacter } from '../lib';

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

    test('is a total no-op while dead — ATTACK is blocked at dispatch, no forward and no refund', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        killCharacter(testbed, constructAddress);
        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);
        const characterBalanceBefore = testbed.getAccount(Context.CharacterAddress)?.balance ?? 0n;

        sendAttack(testbed, { signa: 100n, constructId: CONSTRUCT_ID });

        const construct = testbed.getAccount(CONSTRUCT_ID);
        expect(construct?.balance ?? 0n).toBe(0n);
        // "no refund" means no SIGNA or asset is returned to the owner. The death
        // notification message that handleDead() sends on the kill carries no
        // value (amount 0, no tokens), so it must not be counted as a refund.
        const refundTx = testbed.getTransactions().find(tx =>
            tx.sender === Context.CharacterAddress &&
            tx.recipient === Context.OwnerAccount &&
            ((tx.amount ?? 0n) > 0n || (tx.tokens?.length ?? 0) > 0),
        );
        expect(refundTx).toBeUndefined();
        // The attached SIGNA simply stays on the character's own balance.
        const characterBalanceAfter = testbed.getAccount(Context.CharacterAddress)?.balance ?? 0n;
        expect(characterBalanceAfter).toBeGreaterThan(characterBalanceBefore);
    });
});

// Finding 5: a genuine construct is one deployed by the trusted issuer
// (constructorAccount, sourced from the gamemaster registry). attack() validates
// getCreatorOf(constructId) == constructorAccount so SIGNA can't be forwarded to
// an arbitrary account dressed up as a construct.
describe('attack() — target validation (Finding 5)', () => {
    test('rejects a target not created by constructorAccount — no forward, stays uncommitted, logs error', () => {
        // constructorAccount is the standin's creator (OwnerAccount); 12345n is a
        // random account it did not create (getCreatorOf == 0), so it is refused.
        const { testbed } = deployCharacterWithTrustedConstruct({ constructorAccount: Context.OwnerAccount });

        sendAttack(testbed, { signa: 100n, constructId: 12345n });

        expect(testbed.getAccount(12345n)?.balance ?? 0n).toBe(0n);
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(0n);
        expect(getLastError(testbed)?.code).toBe(Context.Errors.AttackNotPossible);
    });

    test('forwards to a genuine construct created by constructorAccount and commits', () => {
        // constructAddress (888n) was deployed by OwnerAccount == constructorAccount.
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct({ constructorAccount: Context.OwnerAccount });

        sendAttack(testbed, { signa: 100n, constructId: constructAddress });

        expect(getCharState(testbed, Context.Vars.Committed)).toBe(1n);
        expect(testbed.getAccount(constructAddress)?.balance ?? 0n).toBeGreaterThanOrEqual(100n * 1_0000_0000n);
    });
});
