import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import { deployCharacter, getCharState, getAllAttrs, sumAttrs } from '../lib';

describe('init() — deploy-time state', () => {
    test('spends all 5 starting skill points across attributes', () => {
        const testbed = deployCharacter();
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(0n);
        expect(sumAttrs(testbed)).toBe(5n);
    });

    test('each attribute lands within [0, 5]', () => {
        const testbed = deployCharacter();
        const attrs = getAllAttrs(testbed);
        for (const value of Object.values(attrs)) {
            expect(value).toBeGreaterThanOrEqual(0n);
            expect(value).toBeLessThanOrEqual(5n);
        }
    });

    test('maxHitpoints/currentHitpoints derive from stamina (100 + stamina*10)', () => {
        const testbed = deployCharacter();
        const attrs = getAllAttrs(testbed);
        const expectedMaxHp = 100n + attrs.stamina * 10n;
        expect(getCharState(testbed, Context.Vars.MaxHitpoints)).toBe(expectedMaxHp);
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints)).toBe(expectedMaxHp);
    });

    test('maxInventorySlots derives from strength (10 + strength)', () => {
        const testbed = deployCharacter();
        const attrs = getAllAttrs(testbed);
        expect(getCharState(testbed, Context.Vars.MaxInventorySlots)).toBe(10n + attrs.strength);
    });

    test('usedInventorySlots starts at 0 and isDead starts false', () => {
        const testbed = deployCharacter();
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(0n);
    });

    test('attribute distribution is randomized across deploys (statistical, not exact)', () => {
        // getWeakRandomNumber() must not be asserted to an exact value — run many
        // independent deploys and confirm the resulting attribute vectors are not
        // all identical (per signum-smartc testing guidance).
        const snapshots = Array.from({ length: 15 }, (_, i) => {
            const attrs = getAllAttrs(deployCharacter({ address: 2000n + BigInt(i) }));
            return `${attrs.strength},${attrs.stamina},${attrs.dexterity},${attrs.luck},${attrs.willpower}`;
        });
        const distinct = new Set(snapshots);
        expect(distinct.size).toBeGreaterThan(1);
    });
});
