import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharacter,
    getCharState,
    getAllAttrs,
    sumAttrs,
    sendReroll,
    sendAttack,
} from '../lib';

const CONSTRUCT_ID = 12345n;

describe('reroll()', () => {
    test('re-rolls attributes, fully heals, and burns the attached amount', () => {
        const testbed = deployCharacter();
        const before = getAllAttrs(testbed);
        // Account 0 also accumulates the character's own execution fees on
        // top of reroll()'s intentional burn, so assert a floor, not an exact
        // delta — and only against the burn caused by THIS reroll (not fees
        // already incurred by earlier activations, e.g. deployCharacter()).
        const burnBefore = testbed.getAccount(0n)?.balance ?? 0n;

        sendReroll(testbed, { signa: 100_0000_0000n });

        expect(sumAttrs(testbed)).toBe(5n);
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(0n);
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints);
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints)).toBe(maxHp);

        const burnAfter = testbed.getAccount(0n)?.balance ?? 0n;
        expect(burnAfter - burnBefore).toBeGreaterThanOrEqual(100_0000_0000n);

        // Not a hard guarantee the roll differs, but pins that the reset path ran.
        const after = getAllAttrs(testbed);
        expect(after).not.toBe(before);
    });

    test('burns the full attached amount, not just the 100 SIGNA floor', () => {
        const testbed = deployCharacter();
        const burnBefore = testbed.getAccount(0n)?.balance ?? 0n;

        sendReroll(testbed, { signa: 250_0000_0000n });

        const burnAfter = testbed.getAccount(0n)?.balance ?? 0n;
        expect(burnAfter - burnBefore).toBeGreaterThanOrEqual(250_0000_0000n);
    });

    test('increments rerollCount on each successful reroll', () => {
        const testbed = deployCharacter();

        sendReroll(testbed, { signa: 100_0000_0000n });
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(1n);

        sendReroll(testbed, { signa: 100_0000_0000n });
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(2n);
    });

    test('rejects and refunds when the attached amount is below the 100 SIGNA floor', () => {
        const testbed = deployCharacter();
        const before = getAllAttrs(testbed);
        const ownerBefore = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;

        sendReroll(testbed, { signa: 99_0000_0000n });

        expect(getAllAttrs(testbed)).toEqual(before);
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(0n);
        const ownerAfter = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;
        // The 99 Signa comes back; only the (non-refundable) activation fee is lost.
        expect(ownerAfter - ownerBefore).toBeGreaterThan(-Context.ActivationFee * 2n);
        expect(ownerAfter - ownerBefore).toBeLessThanOrEqual(0n);
    });

    test('rejects once committed (after the first ATTACK)', () => {
        const testbed = deployCharacter();
        sendAttack(testbed, { signa: 10n, constructId: CONSTRUCT_ID });
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(1n);
        const before = getAllAttrs(testbed);

        sendReroll(testbed, { signa: 100_0000_0000n });

        expect(getAllAttrs(testbed)).toEqual(before);
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(0n);
    });

    test('rejects the 6th reroll attempt once MAX_REROLLS (5) is reached', () => {
        const testbed = deployCharacter();
        for (let i = 0; i < 5; i++) {
            sendReroll(testbed, { signa: 100_0000_0000n });
        }
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(5n);
        const before = getAllAttrs(testbed);

        sendReroll(testbed, { signa: 100_0000_0000n });

        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(5n);
        expect(getAllAttrs(testbed)).toEqual(before);
    });

    test('ignores reroll from a non-creator sender', () => {
        const testbed = deployCharacter();
        const before = getAllAttrs(testbed);

        sendReroll(testbed, { signa: 100_0000_0000n, sender: 424242n });

        expect(getAllAttrs(testbed)).toEqual(before);
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(0n);
    });
});
