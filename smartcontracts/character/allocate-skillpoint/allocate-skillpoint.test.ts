import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import { deployCharacter, getCharState, getAttr, sendAllocateSkillpoint, fundCharacterWithXp } from '../lib';

// init() spends all 5 starting skill points during deploy (skillPoints ends
// at 0 — see lifecycle/init.test.ts). skillPoints only becomes spendable
// again once checkLevelUp() grants more via XP (see leveling/leveling.test.ts).
describe('allocateSkillpoint()', () => {
    test('is a no-op post-deploy because skillPoints is 0 until a level-up grants more', () => {
        const testbed = deployCharacter();
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(0n);

        const strengthBefore = getAttr(testbed, Context.Attrs.Strength);
        sendAllocateSkillpoint(testbed, Context.Attrs.Strength);

        expect(getAttr(testbed, Context.Attrs.Strength)).toBe(strengthBefore);
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(0n);
    });

    test('spends a post-level-up skill point and increments the target attribute', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase });
        const strengthBefore = getAttr(testbed, Context.Attrs.Strength);

        sendAllocateSkillpoint(testbed, Context.Attrs.Strength);

        expect(getAttr(testbed, Context.Attrs.Strength)).toBe(strengthBefore + 1n);
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(0n);
    });

    test('a STAMINA point recalculates maxHitpoints and carries the delta into currentHitpoints', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase });
        const maxHpBefore = getCharState(testbed, Context.Vars.MaxHitpoints);
        const currentHpBefore = getCharState(testbed, Context.Vars.CurrentHitpoints);

        sendAllocateSkillpoint(testbed, Context.Attrs.Stamina);

        expect(getCharState(testbed, Context.Vars.MaxHitpoints)).toBe(maxHpBefore + 10n);
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints)).toBe(currentHpBefore + 10n);
    });

    test('a STRENGTH point recalculates maxInventorySlots', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase });
        const maxSlotsBefore = getCharState(testbed, Context.Vars.MaxInventorySlots);

        sendAllocateSkillpoint(testbed, Context.Attrs.Strength);

        expect(getCharState(testbed, Context.Vars.MaxInventorySlots)).toBe(maxSlotsBefore + 1n);
    });

    test('a non-STAMINA point leaves maxHitpoints/currentHitpoints unchanged', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase });
        const maxHpBefore = getCharState(testbed, Context.Vars.MaxHitpoints);
        const currentHpBefore = getCharState(testbed, Context.Vars.CurrentHitpoints);

        sendAllocateSkillpoint(testbed, Context.Attrs.Luck);

        expect(getCharState(testbed, Context.Vars.MaxHitpoints)).toBe(maxHpBefore);
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints)).toBe(currentHpBefore);
    });

    test('rejects attrIndex 0 (out of the 1..5 range) even with skill points available', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase });
        sendAllocateSkillpoint(testbed, 0n);
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(1n);
    });

    test('rejects attrIndex 6 (out of the 1..5 range) even with skill points available', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase });
        sendAllocateSkillpoint(testbed, 6n);
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(1n);
    });

    test('ignores calls from a non-creator sender', () => {
        const testbed = deployCharacter();
        const strengthBefore = getAttr(testbed, Context.Attrs.Strength);
        sendAllocateSkillpoint(testbed, Context.Attrs.Strength, 424242n);
        expect(getAttr(testbed, Context.Attrs.Strength)).toBe(strengthBefore);
    });
});
