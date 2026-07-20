import {describe, expect, test} from "vitest";
import {
    deployCharacterWithTrustedConstruct,
    getAttr,
    getCharState,
    landOneCombat,
    landOneHit,
    registerEffectOnGamemasterRegistry,
    sendCombat,
    effectId,
    forgeBlocks,
} from "../lib";
import {Context} from "../context";

// Phase 2: the construct→character COMBAT(rawDamage, effectId, duration) message.
// It deducts HP through the normal mitigation AND applies a timed status effect
// (construct-chosen duration). effectId 0 = pure damage (== DEDUCT_HITPOINTS).
// Construct-only (senderIsConstruct gate). COMBAT always applies the effect as a
// TIMED status regardless of its registry mode, so a construct can't heal/revive
// or permanently buff through it.

const VULN_EFFECT = 5n; // logical effect id: +% damage taken (a construct debuff)

// Registers a "vulnerable" effect (DamageTaken +rel%) usable as a COMBAT payload.
function registerVulnerable(testbed: any, rel: bigint) {
    registerEffectOnGamemasterRegistry(testbed, {
        logicalId: VULN_EFFECT,
        target: Context.EffectTarget.DamageTaken,
        mode: Context.EffectMode.StatusEffect,
        bonusRel: rel,
    });
}

describe("Character COMBAT message", () => {
    test("effectId 0 is pure damage — deducts HP like DEDUCT_HITPOINTS", () => {
        const {testbed, constructAddress} = deployCharacterWithTrustedConstruct();
        const armor = getAttr(testbed, Context.Attrs.Stamina) * Context.DamageMitigation.ArmorPerStamina;

        // net = raw - armor = 40 (retries past dodge)
        expect(landOneCombat(testbed, constructAddress, armor + 40n)).toBe(40n);
    });

    test("applies a timed debuff that raises subsequent damage taken", () => {
        const {testbed, constructAddress} = deployCharacterWithTrustedConstruct();
        registerVulnerable(testbed, 50n);
        const armor = getAttr(testbed, Context.Attrs.Stamina) * Context.DamageMitigation.ArmorPerStamina;

        // COMBAT with a tiny hit but the vulnerable debuff for 100 blocks
        sendCombat(testbed, {sender: constructAddress, rawDamage: 1n, effectId: effectId(VULN_EFFECT), duration: 100n});

        // now a normal hit takes +50%: net 40 → 60
        expect(landOneHit(testbed, constructAddress, armor + 40n)).toBe(60n);
    });

    test("the bundled debuff uses the construct-chosen duration and expires", () => {
        const {testbed, constructAddress} = deployCharacterWithTrustedConstruct();
        registerVulnerable(testbed, 50n);
        const armor = getAttr(testbed, Context.Attrs.Stamina) * Context.DamageMitigation.ArmorPerStamina;

        sendCombat(testbed, {sender: constructAddress, rawDamage: 1n, effectId: effectId(VULN_EFFECT), duration: 3n});
        forgeBlocks(testbed, 5); // past the 3-block duration

        // debuff expired → a normal hit is back to 40
        expect(landOneHit(testbed, constructAddress, armor + 40n)).toBe(40n);
    });

    test("is ignored from a non-construct sender (trust-gated)", () => {
        const {testbed} = deployCharacterWithTrustedConstruct();
        registerVulnerable(testbed, 50n);
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        // owner is not the trusted construct → COMBAT is not dispatched
        sendCombat(testbed, {sender: Context.OwnerAccount, rawDamage: 1000n, effectId: effectId(VULN_EFFECT), duration: 100n});

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(before);
    });
});
