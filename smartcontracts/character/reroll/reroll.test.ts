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
const REROLL_COSTS = 100_0000_0000n; // must mirror the contract's REROLL_COSTS

describe('reroll()', () => {
    test('re-rolls attributes, fully heals, and burns the reroll cost', () => {
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

    test('draws the cost from the character balance — a reroll with no attached SIGNA still succeeds', () => {
        const testbed = deployCharacter();
        // A freshly deployed character already holds more than REROLL_COSTS, so
        // the cost is paid from its own balance without re-attaching any SIGNA.
        sendReroll(testbed, { signa: 0n });

        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(1n);
        expect(sumAttrs(testbed)).toBe(5n);
    });

    test('burns only the reroll cost, leaving any excess attached SIGNA on the character', () => {
        const testbed = deployCharacter();
        const before = testbed.getAccount(Context.CharacterAddress)?.balance ?? 0n;

        sendReroll(testbed, { signa: 250_0000_0000n });

        // 250 attached but only REROLL_COSTS (100) is burned, so the character's
        // balance rises by well over 100 — the surplus is kept, not consumed.
        const after = testbed.getAccount(Context.CharacterAddress)?.balance ?? 0n;
        const delta = after - before;
        expect(delta).toBeGreaterThan(REROLL_COSTS);          // clearly kept the excess
        expect(delta).toBeLessThan(250_0000_0000n);           // but did pay the cost
    });

    test('increments rerollCount on each successful reroll', () => {
        const testbed = deployCharacter();

        sendReroll(testbed, { signa: 100_0000_0000n });
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(1n);

        sendReroll(testbed, { signa: 100_0000_0000n });
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(2n);
    });

    test('rejects when the character balance is below the reroll cost — no reroll, SIGNA retained not refunded', () => {
        const testbed = deployCharacter();
        // Two zero-attached rerolls burn REROLL_COSTS each, draining the ~199 SIGNA
        // starting balance below the 100 SIGNA floor.
        sendReroll(testbed, { signa: 0n });
        sendReroll(testbed, { signa: 0n });
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(2n);
        const charBefore = testbed.getAccount(Context.CharacterAddress)?.balance ?? 0n;
        expect(charBefore).toBeLessThan(REROLL_COSTS); // precondition: below the floor
        const attrsBefore = getAllAttrs(testbed);
        const ownerBefore = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;

        // 50 SIGNA attached is still not enough to clear the floor with the drained balance.
        sendReroll(testbed, { signa: 50_0000_0000n });

        // Rejected: attributes and reroll count are untouched.
        expect(getCharState(testbed, Context.Vars.RerollCount)).toBe(2n);
        expect(getAllAttrs(testbed)).toEqual(attrsBefore);
        // The attached SIGNA is NOT refunded — it accumulates on the character to
        // fund a later reroll (the whole point of drawing from balance).
        const charAfter = testbed.getAccount(Context.CharacterAddress)?.balance ?? 0n;
        expect(charAfter).toBeGreaterThan(charBefore);
        const ownerAfter = testbed.getAccount(Context.OwnerAccount)?.balance ?? 0n;
        expect(ownerAfter).toBeLessThanOrEqual(ownerBefore); // owner only spent, nothing came back
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
