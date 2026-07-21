import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import { deployCharacterWithTrustedConstruct, getCharState, sumAttrs, sendReceiveAttack, sendRefund, killCharacter } from '../lib';

// deathPenaltyApplied (character.contract.smart.c) gates handleDead() so its
// random attribute penalty applies exactly once per death, regardless of how
// many further activations — construct damage, owner methods, or rejected
// transactions from unrelated accounts — occur while isDead stays TRUE.
describe('handleDead() — penalty applies exactly once per death', () => {
    test('a death event applies at most one penalty point in that same activation', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        const sumBefore = sumAttrs(testbed);

        killCharacter(testbed, constructAddress);
        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);

        const sumAfter = sumAttrs(testbed);
        expect(sumAfter).toBeGreaterThanOrEqual(sumBefore - 1n);
        expect(sumAfter).toBeLessThanOrEqual(sumBefore);
    });

    test('further damage from the trusted construct while already dead does NOT apply another penalty', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        killCharacter(testbed, constructAddress);
        const sumAfterDeath = sumAttrs(testbed);

        for (let i = 0; i < 10; i++) {
            sendReceiveAttack(testbed, { sender: constructAddress, rawDamage: 10n });
        }

        expect(sumAttrs(testbed)).toBe(sumAfterDeath);
    });

    test('rejected EOA transactions while dead do NOT apply another penalty', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        killCharacter(testbed, constructAddress);
        const sumAfterDeath = sumAttrs(testbed);

        for (let i = 0; i < 10; i++) {
            sendReceiveAttack(testbed, { sender: 222222n + BigInt(i), rawDamage: 10n });
        }

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(0n);
        expect(sumAttrs(testbed)).toBe(sumAfterDeath);
    });

    test('unrelated owner transactions (REFUND) while dead do NOT apply another penalty', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        killCharacter(testbed, constructAddress);
        const sumAfterDeath = sumAttrs(testbed);

        for (let i = 0; i < 20; i++) {
            sendRefund(testbed);
        }

        expect(sumAttrs(testbed)).toBe(sumAfterDeath);
    });

    test('REFUND while dead does not heal currentHitpoints or clear isDead — only REVIVE does that', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        killCharacter(testbed, constructAddress);

        for (let i = 0; i < 5; i++) {
            sendRefund(testbed);
        }

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);
    });
});
