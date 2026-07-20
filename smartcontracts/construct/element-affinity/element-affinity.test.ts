import {describe, expect, test} from "vitest";
import {attack, deployConstructWithCharacter, getCurrentHitpoints, setCharacterDamage, setCharacterStats, setEffectAffinity} from "../lib";

// Step 3b: element affinity. A character's weapon has a primary attack element
// (its attack effect id), published in the combat profile. The construct holds a
// creator-configured affinity map (SETEFFECTAFFINITY) and applies
// affinity[element] as a FINAL multiplier on the character's attack damage —
// weakness (>100) amplifies, resistance (<100) reduces, unset (0) = neutral.
//
// Construct defaults: base damage 10 for 100 SIGNA. Stat factors set to 0 to
// isolate the affinity multiplier on the base.

const FIRE = 700_101n; // an effect id shared by the weapon and the affinity map

describe("Element Affinity", () => {
    test("amplifies damage when the construct is weak to the attack element", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 0n, 0n);
        setCharacterStats(testbed, {attackEffect: FIRE});
        setEffectAffinity(testbed, FIRE, 150n); // weak to fire

        const before = getCurrentHitpoints(testbed)!;
        attack({testbed, sender: characterAddress, signa: 100n});

        // base 10 × 150 / 100 = 15
        expect(before - getCurrentHitpoints(testbed)!).toBe(15n);
    });

    test("reduces damage when the construct resists the attack element", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 0n, 0n);
        setCharacterStats(testbed, {attackEffect: FIRE});
        setEffectAffinity(testbed, FIRE, 50n); // resistant to fire

        const before = getCurrentHitpoints(testbed)!;
        attack({testbed, sender: characterAddress, signa: 100n});

        // base 10 × 50 / 100 = 5
        expect(before - getCurrentHitpoints(testbed)!).toBe(5n);
    });

    test("is neutral when no affinity is configured for the element", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 0n, 0n);
        setCharacterStats(testbed, {attackEffect: FIRE});
        // no SETEFFECTAFFINITY → unset → neutral

        const before = getCurrentHitpoints(testbed)!;
        attack({testbed, sender: characterAddress, signa: 100n});

        expect(before - getCurrentHitpoints(testbed)!).toBe(10n);
    });

    test("only applies to the character's own published element", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 0n, 0n);
        setCharacterStats(testbed, {attackEffect: FIRE});
        setEffectAffinity(testbed, 999_999n, 150n); // affinity for a DIFFERENT element

        const before = getCurrentHitpoints(testbed)!;
        attack({testbed, sender: characterAddress, signa: 100n});

        // character's element (FIRE) has no affinity → neutral
        expect(before - getCurrentHitpoints(testbed)!).toBe(10n);
    });

    test("stacks after stat/weapon damage as a final multiplier", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 2n, 0n);
        setCharacterStats(testbed, {strength: 5n, attackEffect: FIRE}); // base 10 + 5×2 = 20
        setEffectAffinity(testbed, FIRE, 150n);

        const before = getCurrentHitpoints(testbed)!;
        attack({testbed, sender: characterAddress, signa: 100n});

        // (base 10 + strength 10) × 150 / 100 = 30
        expect(before - getCurrentHitpoints(testbed)!).toBe(30n);
    });
});
