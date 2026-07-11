import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharacter,
    deployCharacterWithTrustedConstruct,
    getAllAttrs,
    getCharState,
    sendDeductHitpoints,
    fundCharacterWithToken,
    sendRevive,
} from '../lib';

function kill(testbed: ReturnType<typeof deployCharacter>, constructAddress: bigint) {
    const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);
    sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: maxHp });
}

describe('REVIVE — explicit method, gated by isDead + live token balance', () => {
    test('revives when the token was attached in the SAME transaction as REVIVE', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        kill(testbed, constructAddress);
        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);

        sendRevive(testbed, { attachToken: {} });

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(0n);
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(maxHp/ 2n);
        const characterTokens = testbed.getContract(Context.CharacterAddress).tokens;
        expect(characterTokens.find(t => t.asset === Context.RevivalTokenId)?.quantity ?? 0n).toBe(0n);
    });

    test('revives using a token that already sat in the contract balance from an earlier transaction', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        fundCharacterWithToken(testbed); // token arrives well before death, no message at all
        kill(testbed, constructAddress);

        sendRevive(testbed);

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(0n);
    });

    test('REVIVE without any token balance does nothing', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        kill(testbed, constructAddress);

        sendRevive(testbed);

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);
    });

    test('REVIVE while still alive does nothing, even with a token balance', () => {
        const testbed = deployCharacter();
        fundCharacterWithToken(testbed);
        const hpBefore = getCharState(testbed, Context.Vars.CurrentHitpoints);

        sendRevive(testbed);

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints)).toBe(hpBefore);
        const characterTokens = testbed.getContract(Context.CharacterAddress).tokens;
        expect(characterTokens.find(t => t.asset === Context.RevivalTokenId)?.quantity ?? 0n).toBe(1n);
    });

    test('REVIVE from a non-owner does nothing', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        kill(testbed, constructAddress);
        fundCharacterWithToken(testbed);

        sendRevive(testbed, { sender: 424242n });

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);
    });

    test('an unconfigured revivalTokenId (0) never accidentally matches a balance of 0', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct({ revivalTokenId: 0n });
        kill(testbed, constructAddress);

        sendRevive(testbed);

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);
    });

    test('resets deathPenaltyApplied so a second death applies another penalty', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        kill(testbed, constructAddress);
        const attrsAfterFirstDeath = getAllAttrs(testbed);
        expect(getCharState(testbed, Context.Vars.DeathPenaltyApplied, Context.CharacterAddress)).toBe(1n);

        sendRevive(testbed, { attachToken: {} });
        expect(getCharState(testbed, Context.Vars.DeathPenaltyApplied, Context.CharacterAddress)).toBe(0n);

        kill(testbed, constructAddress);
        expect(getCharState(testbed, Context.Vars.DeathPenaltyApplied, Context.CharacterAddress)).toBe(1n);

        const attrsAfterSecondDeath = getAllAttrs(testbed);
        const sumFirst = Object.values(attrsAfterFirstDeath).reduce((a, b) => a + b, 0n);
        const sumSecond = Object.values(attrsAfterSecondDeath).reduce((a, b) => a + b, 0n);
        expect(sumSecond).toBeLessThanOrEqual(sumFirst);
    });

    test('only 1 token is burned even if the contract holds more than 1', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        kill(testbed, constructAddress);
        fundCharacterWithToken(testbed, { quantity: 3n });

        sendRevive(testbed);

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(0n);
        const characterTokens = testbed.getContract(Context.CharacterAddress).tokens;
        expect(characterTokens.find(t => t.asset === Context.RevivalTokenId)?.quantity ?? 0n).toBe(2n);
    });
});
