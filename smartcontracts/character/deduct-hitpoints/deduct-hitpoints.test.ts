import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharacter,
    deployCharacterWithGamemasterRegistry,
    deployCharacterWithTrustedConstruct,
    getCharState,
    getAttr,
    sendReceiveAttack,
    setConstructHashOnGamemasterRegistry,
    killCharacter,
    landOneHit,
    grindSkillPointsInto,
} from '../lib';

// Constructs send RAW damage; the Character mitigates it from its own defensive
// attributes (see #define ARMOR_PER_STAMINA / DODGE_* in the contract):
//   dodgeChance% = min(60, (dexterity + luck) * 2)   → dodged hit deals 0
//   otherwise    net = max(0, raw - stamina * 2)
describe('deductHitpoints() — damage mitigation (net = raw reduced by the character)', () => {
    test('a landed hit removes exactly raw minus stamina*armor', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        const armor = getAttr(testbed, Context.Attrs.Stamina) * Context.DamageMitigation.ArmorPerStamina;
        const raw = armor + 40n; // net should be exactly 40

        // landOneHit retries past any dodges and returns the landing hit's delta.
        expect(landOneHit(testbed, constructAddress, raw)).toBe(40n);
    });

    test('stamina armor fully absorbs a hit no larger than stamina*armor (net 0)', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        grindSkillPointsInto(testbed, Context.Attrs.Stamina, 3); // guarantee armor > 0
        const armor = getAttr(testbed, Context.Attrs.Stamina) * Context.DamageMitigation.ArmorPerStamina;
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        for (let i = 0; i < 8; i++) {
            sendReceiveAttack(testbed, { sender: constructAddress, rawDamage: armor }); // net 0 (absorbed or dodged)
        }

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(before);
    });

    test('a high-dexterity character dodges some hits entirely and takes others', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        grindSkillPointsInto(testbed, Context.Attrs.Dexterity, 12); // dodge chance ≥ 24%, ≤ 60%
        const armor = getAttr(testbed, Context.Attrs.Stamina) * Context.DamageMitigation.ArmorPerStamina;
        const raw = armor + 1n; // a non-dodged hit removes exactly 1, so HP-unchanged ⟺ dodged

        let dodges = 0;
        let lands = 0;
        for (let i = 0; i < 50; i++) {
            const before = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);
            sendReceiveAttack(testbed, { sender: constructAddress, rawDamage: raw });
            const after = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);
            if (after === before) dodges++; else lands++;
        }

        expect(dodges).toBeGreaterThan(0);
        expect(lands).toBeGreaterThan(0);
    });

    test('a hit large enough to overcome armor floors HP at 0 and sets isDead', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();

        killCharacter(testbed, constructAddress);

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(1n);
    });

    test('a landed but non-lethal hit does not kill', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        const armor = getAttr(testbed, Context.Attrs.Stamina) * Context.DamageMitigation.ArmorPerStamina;

        landOneHit(testbed, constructAddress, armor + 5n); // net 5, far below maxHp (100+)

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(0n);
    });

    test('non-positive raw damage is ignored — a construct can never heal via deduct', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        sendReceiveAttack(testbed, { sender: constructAddress, rawDamage: 0n });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(before);
    });

    // The `rawDamage <= 0` guard also rejects negatives (which would otherwise
    // ADD hitpoints), but the testbed can't encode a negative in a message word
    // (known bigint-to-AT-word bug — see references/testing.md), so this can't
    // be exercised end-to-end here.
    test.skip('negative raw damage is ignored (cannot be sent via the testbed — FIXME)', () => {});

    test('ignores RECEIVE_ATTACK sent from the owner account itself (only construct-gated senders reach it)', () => {
        const testbed = deployCharacter();
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints);

        sendReceiveAttack(testbed, { sender: Context.OwnerAccount, rawDamage: 10n });

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

        sendReceiveAttack(testbed, { sender: 999999999n, rawDamage: maxHp });

        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints)).toBe(maxHp);
    });

    test('an arbitrary EOA is rejected even with the registry deployed and configured', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);

        sendReceiveAttack(testbed, { sender: 999999999n, rawDamage: maxHp * 4n });

        // Untrusted sender never reaches deductHitpoints, so HP is untouched.
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(maxHp);
        // Sanity: the legitimately trusted construct in this same setup CAN land damage.
        expect(landOneHit(testbed, constructAddress, maxHp * 4n)).toBeGreaterThan(0n);
    });

    test('the real construct stand-in is authorized once correctly registered', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();

        // If it were unauthorized, no hit would ever land and this would throw.
        expect(landOneHit(testbed, constructAddress, 100n)).toBeGreaterThan(0n);
    });

    test('the construct stand-in is still rejected before its hash is registered', () => {
        const { testbed, constructAddress } = deployCharacterWithGamemasterRegistry();
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        sendReceiveAttack(testbed, { sender: constructAddress, rawDamage: before * 4n });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(before);
    });

    test('registering a DIFFERENT codehash than the stand-in still rejects that stand-in', () => {
        const { testbed, constructAddress, constructStandIn } = deployCharacterWithGamemasterRegistry();
        setConstructHashOnGamemasterRegistry(testbed, constructStandIn!.codeHashId + 1n);
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        sendReceiveAttack(testbed, { sender: constructAddress, rawDamage: before * 4n });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(before);
    });
});
