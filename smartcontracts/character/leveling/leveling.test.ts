import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import { deployCharacter, getCharState, fundCharacterWithXp, sendTransferItem } from '../lib';

// XP is a scarce, combat-minted token (only constructs mint it) but freely
// tradable, so the character levels on its held XP balance — this lets earned
// XP be traded and lets a returning player move XP from their EOA into the
// character. nextLevelXp only advances, so trading XP out never de-levels.
describe('checkLevelUp()', () => {
    test('starts at level 1 with no XP', () => {
        const testbed = deployCharacter();
        expect(getCharState(testbed, Context.Vars.Level)).toBe(1n);
        expect(getCharState(testbed, Context.Vars.NextLevelXp)).toBe(Context.LevelXpBase);
    });

    test('reaching the level-2 XP threshold grants 1 skill point and advances the threshold', () => {
        const testbed = deployCharacter();
        const skillPointsBefore = getCharState(testbed, Context.Vars.SkillPoints);

        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase });

        expect(getCharState(testbed, Context.Vars.Level)).toBe(2n);
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(skillPointsBefore + 1n);
        // Triangular: threshold for level 3 = 1000 * 3*2/2 = 3000.
        expect(getCharState(testbed, Context.Vars.NextLevelXp)).toBe(Context.LevelXpBase * 3n);
    });

    test('XP just below the threshold does not level up', () => {
        const testbed = deployCharacter();

        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase - 1n });

        expect(getCharState(testbed, Context.Vars.Level)).toBe(1n);
    });

    test('a large XP jump grants multiple levels and skill points in one activation', () => {
        const testbed = deployCharacter();
        const skillPointsBefore = getCharState(testbed, Context.Vars.SkillPoints);

        // Triangular thresholds to REACH each level: L2=1000, L3=3000, L4=6000,
        // L5=10000. 7000 XP clears 2, 3 and 4 (>=6000) but not 5 (<10000).
        fundCharacterWithXp(testbed, { quantity: 7000n });

        expect(getCharState(testbed, Context.Vars.Level)).toBe(4n);
        expect(getCharState(testbed, Context.Vars.SkillPoints)).toBe(skillPointsBefore + 3n);
        expect(getCharState(testbed, Context.Vars.NextLevelXp)).toBe(10000n); // threshold for level 5
    });

    test('the gap grows linearly, not exponentially (triangular curve)', () => {
        const testbed = deployCharacter();

        // Exactly the level-5 threshold: 1000 * 5*4/2 = 10000.
        fundCharacterWithXp(testbed, { quantity: 10000n });

        expect(getCharState(testbed, Context.Vars.Level)).toBe(5n);
        // Threshold for level 6 = 1000 * 6*5/2 = 15000 (exponential doubling would be 16000).
        expect(getCharState(testbed, Context.Vars.NextLevelXp)).toBe(15000n);
    });

    test('XP is bound to the character — it cannot be transferred out to level, so it stays and the level holds', () => {
        const testbed = deployCharacter();
        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase });
        expect(getCharState(testbed, Context.Vars.Level)).toBe(2n);

        // Attempting to withdraw XP is a rejected no-op (see transfer-item tests):
        // XP can never leave a character, so it can't be recycled to level another.
        sendTransferItem(testbed, { itemId: Context.XpTokenId, recipientId: 424242n });

        expect(testbed.getContract(Context.CharacterAddress).tokens.find(t => t.asset === Context.XpTokenId)?.quantity ?? 0n).toBe(Context.LevelXpBase);
        expect(getCharState(testbed, Context.Vars.Level)).toBe(2n);
    });

    test('sends a congratulatory message to the owner on level-up', () => {
        const testbed = deployCharacter();

        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase });

        const levelUpMessage = testbed.getTransactions().find(tx =>
            tx.sender === Context.CharacterAddress && tx.recipient === Context.OwnerAccount && tx.messageText,
        );
        expect(levelUpMessage?.messageText).toContain('leveled up');
    });

    test('sends no message when XP is received but no level-up occurs', () => {
        const testbed = deployCharacter();

        fundCharacterWithXp(testbed, { quantity: Context.LevelXpBase - 1n });

        const levelUpMessage = testbed.getTransactions().find(tx =>
            tx.sender === Context.CharacterAddress && tx.recipient === Context.OwnerAccount && tx.messageText,
        );
        expect(levelUpMessage).toBeUndefined();
    });
});
