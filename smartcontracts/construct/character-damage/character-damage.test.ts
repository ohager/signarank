import {describe, expect, test} from "vitest";
import {attack, deployConstructWithCharacter, getCurrentHitpoints, setCharacterDamage, setCharacterStats} from "../lib";
import {Context} from "../context";

// Step 3: a character attacker's damage extends the SIGNA base with its PUBLISHED
// combat profile — effective strength × strFactor + level × lvlFactor, plus the
// equipped weapon's attack bonus (abs then rel %) — all read from the character's
// public map (the weapon stays equipped, never attached). The single attached
// asset is instead a consumable element token, amplified EOA-style. The existing
// breach-limit cap still applies.
//
// Construct defaults (deployConstruct): baseDamageRatio 10, maxHp 50000,
// breachLimit 20% (cap 10000), debuff disabled. So 100 SIGNA → base damage 10.

describe("Character Damage", () => {
    test("adds effective strength × strFactor to the SIGNA base", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 2n, 0n);      // strFactor 2, lvlFactor 0 (level ignored)
        setCharacterStats(testbed, {strength: 5n});

        const before = getCurrentHitpoints(testbed)!;
        attack({testbed, sender: characterAddress, signa: 100n});

        // base 10 + strength 5 × 2 = 20
        expect(before - getCurrentHitpoints(testbed)!).toBe(20n);
    });

    test("adds level × lvlFactor to the SIGNA base", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 0n, 3n);      // strFactor 0 (strength ignored), lvlFactor 3
        setCharacterStats(testbed, {strength: 5n, level: 4n});

        const before = getCurrentHitpoints(testbed)!;
        attack({testbed, sender: characterAddress, signa: 100n});

        // base 10 + level 4 × 3 = 22 (strength contributes 0)
        expect(before - getCurrentHitpoints(testbed)!).toBe(22n);
    });

    test("adds the equipped weapon's published attack abs", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 0n, 0n);      // isolate the weapon: no stat bonus
        setCharacterStats(testbed, {attackAbs: 25n});

        const before = getCurrentHitpoints(testbed)!;
        attack({testbed, sender: characterAddress, signa: 100n});

        // base 10 + weapon attackAbs 25 = 35
        expect(before - getCurrentHitpoints(testbed)!).toBe(35n);
    });

    test("scales by the equipped weapon's published attack rel (percent)", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 0n, 0n);
        setCharacterStats(testbed, {attackRel: 50n});

        const before = getCurrentHitpoints(testbed)!;
        attack({testbed, sender: characterAddress, signa: 100n});

        // (base 10 + 0) × (100 + 50)/100 = 15
        expect(before - getCurrentHitpoints(testbed)!).toBe(15n);
    });

    test("still caps character damage at the breach limit", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setCharacterDamage(testbed, 1000n, 0n);
        setCharacterStats(testbed, {strength: 100n}); // statBonus 100000 → raw ~100010

        const before = getCurrentHitpoints(testbed)!;
        attack({testbed, sender: characterAddress, signa: 100n});

        // capped at maxHp × breachLimit / 100 = 50000 × 20 / 100 = 10000
        expect(before - getCurrentHitpoints(testbed)!).toBe(10000n);
    });

    test("amplifies with an attached consumable element token (EOA-style)", () => {
        const elementToken = 3000n;
        const {testbed, characterAddress} = deployConstructWithCharacter({}, {
            extraTxs: [{
                sender: Context.CreatorAccount,
                amount: Context.ActivationFee,
                messageArr: [Context.Methods.SetDamageAddition, elementToken, 50n, 0n],
            }],
        });
        setCharacterDamage(testbed, 0n, 0n);

        const before = getCurrentHitpoints(testbed)!;
        // the character attaches (and forfeits) the element token → +50 damage
        attack({testbed, sender: characterAddress, signa: 100n, tokens: [{asset: elementToken, quantity: 1n}]});

        // base 10 + element-token addition 50 = 60
        expect(before - getCurrentHitpoints(testbed)!).toBe(60n);
    });
});
