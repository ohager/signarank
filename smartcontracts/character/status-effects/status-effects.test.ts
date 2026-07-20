import {describe, expect, test} from "vitest";
import {
    deployCharacter,
    deployCharacterWithTrustedConstruct,
    getAttr,
    getPublicCombat,
    landOneHit,
    registerItemOnGamemasterRegistry,
    registerEffectOnGamemasterRegistry,
    setItemEffectOnGamemasterRegistry,
    fundCharacterWithToken,
    sendUseItem,
    forgeBlocks,
    pokeCharacter,
    getStatusEffectId,
    effectId,
} from "../lib";
import {Context} from "../context";

// Phase 1 of the status-effect engine: MODE_STATUS_EFFECT items now apply a timed
// buff/debuff stored per target (effectId magnitude + expiry) and lazily consumed
// at read time — folded into the published combat profile (attack/stats) and into
// deductHitpoints (damage taken). One effect per target; expiry via block height.

const RAGE = 6000n;  // +% attack
const MIGHT = 6001n; // +strength (flat)
const VULN = 6002n;  // +% damage taken

function registerStatusPotion(
    testbed: any,
    tokenId: bigint,
    logicalId: bigint,
    target: bigint,
    opts: {bonusAbs?: bigint; bonusRel?: bigint; duration: bigint},
) {
    registerItemOnGamemasterRegistry(testbed, {tokenId, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n});
    registerEffectOnGamemasterRegistry(testbed, {logicalId, target, mode: Context.EffectMode.StatusEffect, bonusAbs: opts.bonusAbs ?? 0n, bonusRel: opts.bonusRel ?? 0n, duration: opts.duration});
    setItemEffectOnGamemasterRegistry(testbed, {tokenId, slot: 0n, logicalEffectId: logicalId});
}

describe("Character Status Effects", () => {
    test("a status potion buffs the published attack rel while active", () => {
        const testbed = deployCharacter();
        registerStatusPotion(testbed, RAGE, 1n, Context.EffectTarget.AttackDamage, {bonusRel: 50n, duration: 100n});
        fundCharacterWithToken(testbed, {tokenId: RAGE, quantity: 1n});

        expect(getPublicCombat(testbed, Context.CombatKeys.AttackRel)).toBe(0n);

        sendUseItem(testbed, {tokenId: RAGE});

        expect(getPublicCombat(testbed, Context.CombatKeys.AttackRel)).toBe(50n);
    });

    test("the buff reverts after it expires", () => {
        const testbed = deployCharacter();
        registerStatusPotion(testbed, RAGE, 1n, Context.EffectTarget.AttackDamage, {bonusRel: 50n, duration: 5n});
        fundCharacterWithToken(testbed, {tokenId: RAGE, quantity: 1n});
        sendUseItem(testbed, {tokenId: RAGE});
        expect(getPublicCombat(testbed, Context.CombatKeys.AttackRel)).toBe(50n);

        forgeBlocks(testbed, 6); // past the 5-block duration
        pokeCharacter(testbed);  // republish the profile

        expect(getPublicCombat(testbed, Context.CombatKeys.AttackRel)).toBe(0n);
    });

    test("a flat strength potion buffs effective strength", () => {
        const testbed = deployCharacter();
        const base = getAttr(testbed, Context.Attrs.Strength);
        registerStatusPotion(testbed, MIGHT, 2n, Context.EffectTarget.Strength, {bonusAbs: 4n, duration: 100n});
        fundCharacterWithToken(testbed, {tokenId: MIGHT, quantity: 1n});

        sendUseItem(testbed, {tokenId: MIGHT});

        expect(getPublicCombat(testbed, Context.CombatKeys.Strength)).toBe(base + 4n);
    });

    test("a vulnerable debuff increases damage taken while active", () => {
        const {testbed, constructAddress} = deployCharacterWithTrustedConstruct();
        registerStatusPotion(testbed, VULN, 3n, Context.EffectTarget.DamageTaken, {bonusRel: 50n, duration: 100n});
        fundCharacterWithToken(testbed, {tokenId: VULN, quantity: 1n});
        const armor = getAttr(testbed, Context.Attrs.Stamina) * Context.DamageMitigation.ArmorPerStamina;

        sendUseItem(testbed, {tokenId: VULN});

        // net would be 40 without the debuff; +50% damage taken → 60
        expect(landOneHit(testbed, constructAddress, armor + 40n)).toBe(60n);
    });

    test("stores the source effectId per target when a status effect is applied", () => {
        const testbed = deployCharacter();
        const logical = 3n;
        registerStatusPotion(testbed, VULN, logical, Context.EffectTarget.DamageTaken, {bonusRel: 50n, duration: 20n});
        fundCharacterWithToken(testbed, {tokenId: VULN, quantity: 1n});

        sendUseItem(testbed, {tokenId: VULN});

        expect(getStatusEffectId(testbed, Context.EffectTarget.DamageTaken)).toBe(effectId(logical));
    });
});
