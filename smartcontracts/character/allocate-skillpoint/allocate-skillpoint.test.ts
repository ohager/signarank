import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import { deployCharacter, getCharState, getAttr, sendAllocateSkillpoint } from '../lib';

// KNOWN LIMITATION: init() spends all 5 starting skill points during deploy
// (skillPoints ends at 0 — see lifecycle/init.test.ts). Nothing in the current
// contract ever grants more skillPoints afterwards (no leveling/XP path is
// implemented yet), so ALLOCATE_SKILLPOINT is unreachable as a no-op today.
// These tests characterize that reality, not the intended future behavior.
describe('allocateSkillpoint()', () => {
    test('is a no-op post-deploy because skillPoints is always 0', () => {
        const testbed = deployCharacter();
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(0n);

        const strengthBefore = getAttr(testbed, Context.Attrs.Strength);
        sendAllocateSkillpoint(testbed, Context.Attrs.Strength);

        expect(getAttr(testbed, Context.Attrs.Strength)).toBe(strengthBefore);
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(0n);
    });

    test('rejects attrIndex 0 (out of the 1..5 range) even hypothetically', () => {
        const testbed = deployCharacter();
        sendAllocateSkillpoint(testbed, 0n);
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(0n);
    });

    test('rejects attrIndex 6 (out of the 1..5 range) even hypothetically', () => {
        const testbed = deployCharacter();
        sendAllocateSkillpoint(testbed, 6n);
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(0n);
    });

    test('ignores calls from a non-creator sender', () => {
        const testbed = deployCharacter();
        const strengthBefore = getAttr(testbed, Context.Attrs.Strength);
        sendAllocateSkillpoint(testbed, Context.Attrs.Strength, 424242n);
        expect(getAttr(testbed, Context.Attrs.Strength)).toBe(strengthBefore);
    });
});
