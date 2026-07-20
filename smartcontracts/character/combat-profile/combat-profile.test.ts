import {describe, expect, test} from "vitest";
import {
    deployCharacter,
    getAttr,
    getPublicCombat,
    registerItemOnGamemasterRegistry,
    registerEffectOnGamemasterRegistry,
    setItemEffectOnGamemasterRegistry,
    fundCharacterWithToken,
    sendTransferItem,
    effectId,
} from "../lib";
import {Context} from "../context";

// The character publishes an effective-combat profile (Maps.Combat) every
// activation so the construct can read a character's offensive stats without the
// weapon ever being attached/transferred. Effective = base attribute + the
// equipment aggregate the character already maintains in EQUIP_BONUS[target].

const WEAPON_ID = 5000n;
const RING_ID = 5001n;

describe("Character Combat Profile", () => {
    test("publishes effective strength/luck equal to base attributes when unequipped", () => {
        const testbed = deployCharacter();
        expect(getPublicCombat(testbed, Context.CombatKeys.Strength)).toBe(getAttr(testbed, Context.Attrs.Strength));
        expect(getPublicCombat(testbed, Context.CombatKeys.Luck)).toBe(getAttr(testbed, Context.Attrs.Luck));
    });

    test("publishes zero attack abs/rel when no weapon is equipped", () => {
        const testbed = deployCharacter();
        expect(getPublicCombat(testbed, Context.CombatKeys.AttackAbs)).toBe(0n);
        expect(getPublicCombat(testbed, Context.CombatKeys.AttackRel)).toBe(0n);
    });

    test("publishes the equipped weapon's attack abs and rel", () => {
        const testbed = deployCharacter();
        registerItemOnGamemasterRegistry(testbed, {tokenId: WEAPON_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 2n});
        registerEffectOnGamemasterRegistry(testbed, {logicalId: 1n, target: Context.EffectTarget.AttackDamage, mode: Context.EffectMode.AggregateAbs, bonusAbs: 25n});
        registerEffectOnGamemasterRegistry(testbed, {logicalId: 2n, target: Context.EffectTarget.AttackDamage, mode: Context.EffectMode.AggregateRel, bonusRel: 50n});
        setItemEffectOnGamemasterRegistry(testbed, {tokenId: WEAPON_ID, slot: 0n, logicalEffectId: 1n});
        setItemEffectOnGamemasterRegistry(testbed, {tokenId: WEAPON_ID, slot: 1n, logicalEffectId: 2n});

        fundCharacterWithToken(testbed, {tokenId: WEAPON_ID});

        expect(getPublicCombat(testbed, Context.CombatKeys.AttackAbs)).toBe(25n);
        expect(getPublicCombat(testbed, Context.CombatKeys.AttackRel)).toBe(50n);
    });

    test("folds strength-boosting equipment into effective strength", () => {
        const testbed = deployCharacter();
        const baseStrength = getAttr(testbed, Context.Attrs.Strength);
        registerItemOnGamemasterRegistry(testbed, {tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 1n});
        registerEffectOnGamemasterRegistry(testbed, {logicalId: 1n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.AggregateAbs, bonusAbs: 3n});
        setItemEffectOnGamemasterRegistry(testbed, {tokenId: RING_ID, slot: 0n, logicalEffectId: 1n});

        fundCharacterWithToken(testbed, {tokenId: RING_ID});

        expect(getPublicCombat(testbed, Context.CombatKeys.Strength)).toBe(baseStrength + 3n);
    });

    test("publishes the equipped weapon's primary attack effect id (for construct affinity)", () => {
        const testbed = deployCharacter();
        registerItemOnGamemasterRegistry(testbed, {tokenId: WEAPON_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 1n});
        registerEffectOnGamemasterRegistry(testbed, {logicalId: 7n, target: Context.EffectTarget.AttackDamage, mode: Context.EffectMode.AggregateAbs, bonusAbs: 25n});
        setItemEffectOnGamemasterRegistry(testbed, {tokenId: WEAPON_ID, slot: 0n, logicalEffectId: 7n});

        fundCharacterWithToken(testbed, {tokenId: WEAPON_ID});

        expect(getPublicCombat(testbed, Context.CombatKeys.AttackEffect)).toBe(effectId(7n));
    });

    test("clears the primary attack effect id when the weapon is unequipped", () => {
        const testbed = deployCharacter();
        registerItemOnGamemasterRegistry(testbed, {tokenId: WEAPON_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 1n});
        registerEffectOnGamemasterRegistry(testbed, {logicalId: 7n, target: Context.EffectTarget.AttackDamage, mode: Context.EffectMode.AggregateAbs, bonusAbs: 25n});
        setItemEffectOnGamemasterRegistry(testbed, {tokenId: WEAPON_ID, slot: 0n, logicalEffectId: 7n});
        fundCharacterWithToken(testbed, {tokenId: WEAPON_ID});
        expect(getPublicCombat(testbed, Context.CombatKeys.AttackEffect)).toBe(effectId(7n));

        sendTransferItem(testbed, {itemId: WEAPON_ID, recipientId: Context.OwnerAccount});

        expect(getPublicCombat(testbed, Context.CombatKeys.AttackEffect)).toBe(0n);
    });
});
