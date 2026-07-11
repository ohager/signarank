import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharacter,
    deployCharacterWithGamemasterRegistry,
    deployCharacterWithTrustedConstruct,
    getCharState,
    sendDeductHitpoints,
    setConstructHashOnGamemasterRegistry,
} from '../lib';

describe('deductHitpoints() — normal damage path (via a correctly-trusted construct)', () => {
    test('reduces currentHitpoints by the given amount', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: 10n });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(before - 10n);
    });

    test('floors currentHitpoints at 0 and sets isDead', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);

        sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: maxHp + 500n });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);
    });

    test('does not die from damage that leaves HP above 0', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);

        sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: maxHp - 1n });

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(0n);
    });

    test('ignores DEDUCT_HITPOINTS sent from the owner account itself (only construct-gated senders reach it)', () => {
        const testbed = deployCharacter();
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints);

        sendDeductHitpoints(testbed, { sender: Context.OwnerAccount, hitpoints: 10n });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints)).toBe(before);
    });
});

// senderIsConstruct() trusts a construct only if the gamemaster registry has
// a non-zero codehash registered at GAMEMASTER_MAP_KEY1_CONSTRUCT_HASH that
// matches the sender's own codehash — an unconfigured (zero) hash is rejected
// explicitly rather than coincidentally matching an EOA's own zero codehash.
describe('senderIsConstruct() security', () => {
    test('with no gamemaster registry deployed, an arbitrary EOA is rejected', () => {
        const testbed = deployCharacter();
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints);

        sendDeductHitpoints(testbed, { sender: 999999999n, hitpoints: maxHp });

        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(0n);
    });

    test('an arbitrary EOA is rejected even with the registry deployed and configured', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();

        sendDeductHitpoints(testbed, { sender: 999999999n, hitpoints: 10n });

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(0n);
        // sanity: the legitimately trusted construct still works in this same setup
        sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: 10n });
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress))
            .toBeLessThan(getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress));
    });

    test('the real construct stand-in is authorized once correctly registered', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: 10n });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(before - 10n);
    });

    test('the construct stand-in is still rejected before its hash is registered', () => {
        const { testbed, constructAddress } = deployCharacterWithGamemasterRegistry();
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: 10n });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(before);
    });

    test('registering a DIFFERENT codehash than the stand-in still rejects that stand-in', () => {
        const { testbed, constructAddress, constructStandIn } = deployCharacterWithGamemasterRegistry();
        setConstructHashOnGamemasterRegistry(testbed, constructStandIn!.codeHashId + 1n);
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: 10n });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(before);
    });
});
