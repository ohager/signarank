import {describe, expect, test} from "vitest";
import {deployCharacter, getVitals, getAttr, landOneCombat, deployCharacterWithTrustedConstruct} from "../lib";
import {Context} from "../context";

describe("Character VITALS map", () => {
    test("publishes currentHp, maxHp and isDead at deploy", () => {
        const testbed = deployCharacter();
        const maxHp = getVitals(testbed, Context.VitalsKeys.MaxHp);
        expect(maxHp).toBeGreaterThan(0n);
        expect(getVitals(testbed, Context.VitalsKeys.CurrentHp)).toBe(maxHp); // full HP at spawn
        expect(getVitals(testbed, Context.VitalsKeys.IsDead)).toBe(0n);
    });

    test("currentHp drops after a combat hit and isDead flips on death", () => {
        const {testbed, constructAddress} = deployCharacterWithTrustedConstruct();
        const maxHp = getVitals(testbed, Context.VitalsKeys.MaxHp);
        // Raw damage below armor (stamina * ArmorPerStamina) is fully absorbed, so
        // send an armor-relative survivable hit — mirrors deduct-hitpoints.test.ts.
        const stamina = getAttr(testbed, Context.Attrs.Stamina);
        const armor = stamina * Context.DamageMitigation.ArmorPerStamina;
        landOneCombat(testbed, constructAddress, armor + 5n); // net 5, survivable
        expect(getVitals(testbed, Context.VitalsKeys.CurrentHp)).toBeLessThan(maxHp);
        expect(getVitals(testbed, Context.VitalsKeys.IsDead)).toBe(0n);

        landOneCombat(testbed, constructAddress, maxHp + 1000n); // lethal
        expect(getVitals(testbed, Context.VitalsKeys.CurrentHp)).toBe(0n);
        expect(getVitals(testbed, Context.VitalsKeys.IsDead)).toBe(1n);
    });
});
