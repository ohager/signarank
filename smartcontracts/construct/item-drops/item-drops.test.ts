import {describe, expect, test} from "vitest";
import {
    attack,
    deployConstructWithCharacter,
    fundConstructWithToken,
    setCharacterStats,
    setDropDamageThreshold,
    setDropModifiers,
    setDropToken,
    setLuckFactor,
    timeLapse,
} from "../lib";
import {Context} from "../context";

// Step 5: item drops. A single luck-scaled D100 roll per hit — character or EOA
// attacker — decides all slots at once; for every configured slot, drop iff
// effectiveRoll < threshold. A character's drop goes to its owner EOA (same
// reward-routing recipient as the hp-token share, since the character contract
// itself would just bounce an undeposited item back); an EOA attacker's drop
// goes straight to that EOA. Luck only ever applies for a character (an EOA has
// no combat stats), so an EOA effectively rolls at luck 0 — lower drop chances,
// not exclusion. A hit must also deal at least dropDamageThreshold HP to even
// roll — final blows are exempt — so looting has a real (SIGNA) cost, not just
// participation. Supply-guarded by the construct's own balance. Bands are nested.
//
//   dropDamageThreshold defaults to 10 HP; damage(signa) = signa × baseDamageRatio
//   / 100, and baseDamageRatio defaults to 10 → 100 SIGNA deals exactly 10 HP, so
//   the pre-existing 100-SIGNA attacks throughout this file clear the default
//   threshold incidentally. Tests below that specifically probe the threshold
//   use smaller/larger SIGNA amounts to land clearly above or below it.
//
//   effectiveRoll = roll(0..99) + attackTypeModifier − luck × luckFactor
//   defaults: normal +15, firstBlood 0, finalBlow −15, luckFactor 1
//
// Deterministic testing (never asserts on the random roll itself):
//   threshold ≥ 115  → always drops (max effectiveRoll = 99 + 15)
//   threshold ≤ minEffectiveRoll → never drops
// Flattening the modifiers to a constant (SETDROPMODIFIERS(m,m,m)) makes a single
// hit's band math independent of which attack type it is.

function held(testbed: any, holder: bigint, asset: bigint, isContract = true): bigint {
    const acct = isContract ? testbed.getContract(holder) : testbed.getAccount(holder);
    return acct?.tokens.find((t: any) => t.asset === asset)?.quantity ?? 0n;
}

const DROP = 4000n;
const RARE = 4001n;

describe("Item Drops", () => {
    test("drops the configured token to the character's owner on a hit (guaranteed band)", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 3n); // threshold 200 → always drops
        fundConstructWithToken(testbed, DROP, 100n);

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterOwner, DROP, false)).toBe(3n);
        expect(held(testbed, characterAddress, DROP)).toBe(0n);
    });

    test("does not drop when the roll misses the band", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        // threshold 0 with a first-blood hit (mod 0) and luck 0 → effectiveRoll ≥ 0, never < 0
        setDropToken(testbed, 0n, DROP, 0n, 3n);
        fundConstructWithToken(testbed, DROP, 100n);

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterOwner, DROP, false)).toBe(0n);
    });

    test("drops all qualifying slots together (nested bands)", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, RARE, 200n, 1n);
        setDropToken(testbed, 1n, DROP, 200n, 5n);
        fundConstructWithToken(testbed, RARE, 10n);
        fundConstructWithToken(testbed, DROP, 100n);

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterOwner, RARE, false)).toBe(1n);
        expect(held(testbed, characterOwner, DROP, false)).toBe(5n);
    });

    test("does not drop when the construct holds none of the token", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 3n); // would always drop
        // not funded → balance 0

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterOwner, DROP, false)).toBe(0n);
    });

    test("does not drop when the supply is below the drop quantity", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 5n);
        fundConstructWithToken(testbed, DROP, 2n); // holds < quantity

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterOwner, DROP, false)).toBe(0n);
    });

    test("drops the configured token straight to an EOA attacker (guaranteed band)", () => {
        const {testbed} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 3n); // threshold 200 → always drops, even at luck 0
        fundConstructWithToken(testbed, DROP, 100n);

        attack({testbed, sender: Context.SenderAccount1, signa: 100n});

        expect(held(testbed, Context.SenderAccount1, DROP, false)).toBe(3n);
    });

    test("an EOA attacker has no luck bonus, so a lucky character's guaranteed drop can still miss for the EOA", () => {
        // Flat +15 modifier, threshold 5.
        // luck 110 (character) → effectiveRoll = roll + 15 − 110 ≤ 4 → always < 5 (drop)
        // EOA has no luck stat (forced to 0) → effectiveRoll = roll + 15 ≥ 15 → never < 5 (no drop)
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        setDropModifiers(testbed, 15n, 15n, 15n);
        setDropToken(testbed, 0n, DROP, 5n, 1n);
        fundConstructWithToken(testbed, DROP, 100n);
        setCharacterStats(testbed, {luck: 110n});

        attack({testbed, sender: characterAddress, signa: 100n});
        expect(held(testbed, characterOwner, DROP, false)).toBe(1n);

        attack({testbed, sender: Context.SenderAccount1, signa: 100n});
        expect(held(testbed, Context.SenderAccount1, DROP, false)).toBe(0n);
    });

    test("higher luck turns a missed band into a drop", () => {
        // Flat +15 modifier for any attack type, threshold 5.
        // luck 0  → effectiveRoll = roll + 15 ≥ 15 → never < 5 (no drop)
        // luck 110 → effectiveRoll = roll + 15 − 110 ≤ 4 → always < 5 (drop)
        const noLuck = deployConstructWithCharacter();
        setDropModifiers(noLuck.testbed, 15n, 15n, 15n);
        setDropToken(noLuck.testbed, 0n, DROP, 5n, 1n);
        fundConstructWithToken(noLuck.testbed, DROP, 100n);
        setCharacterStats(noLuck.testbed, {luck: 0n});
        attack({testbed: noLuck.testbed, sender: noLuck.characterAddress, signa: 100n});
        expect(held(noLuck.testbed, noLuck.characterOwner, DROP, false)).toBe(0n);

        const lucky = deployConstructWithCharacter();
        setDropModifiers(lucky.testbed, 15n, 15n, 15n);
        setDropToken(lucky.testbed, 0n, DROP, 5n, 1n);
        fundConstructWithToken(lucky.testbed, DROP, 100n);
        setCharacterStats(lucky.testbed, {luck: 110n});
        attack({testbed: lucky.testbed, sender: lucky.characterAddress, signa: 100n});
        expect(held(lucky.testbed, lucky.characterOwner, DROP, false)).toBe(1n);
    });

    test("luck factor scales the luck contribution", () => {
        // Flat +15, threshold 5, luck 10.
        // factor 1  → roll + 15 − 10 = roll + 5 ≥ 5 → never < 5 (no drop)
        // factor 20 → roll + 15 − 200 ≤ −86 → always < 5 (drop)
        const f1 = deployConstructWithCharacter();
        setDropModifiers(f1.testbed, 15n, 15n, 15n);
        setDropToken(f1.testbed, 0n, DROP, 5n, 1n);
        fundConstructWithToken(f1.testbed, DROP, 100n);
        setCharacterStats(f1.testbed, {luck: 10n});
        setLuckFactor(f1.testbed, 1n);
        attack({testbed: f1.testbed, sender: f1.characterAddress, signa: 100n});
        expect(held(f1.testbed, f1.characterOwner, DROP, false)).toBe(0n);

        const f20 = deployConstructWithCharacter();
        setDropModifiers(f20.testbed, 15n, 15n, 15n);
        setDropToken(f20.testbed, 0n, DROP, 5n, 1n);
        fundConstructWithToken(f20.testbed, DROP, 100n);
        setCharacterStats(f20.testbed, {luck: 10n});
        setLuckFactor(f20.testbed, 20n);
        attack({testbed: f20.testbed, sender: f20.characterAddress, signa: 100n});
        expect(held(f20.testbed, f20.characterOwner, DROP, false)).toBe(1n);
    });

    test("a final blow is favoured over a normal hit for drops", () => {
        // normal +200 (never drops at threshold 5), finalBlow −200 (always drops).
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter({maxHp: 100n, breachLimit: 100n});
        setDropModifiers(testbed, 200n, 200n, -200n);
        setDropToken(testbed, 0n, DROP, 5n, 1n);
        fundConstructWithToken(testbed, DROP, 100n);

        // one-shot defeat → final blow
        attack({testbed, sender: characterAddress, signa: 1100n});

        expect(held(testbed, characterOwner, DROP, false)).toBe(1n);
    });

    test("clearing a slot (tokenId 0) stops its drops", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 3n);
        fundConstructWithToken(testbed, DROP, 100n);
        setDropToken(testbed, 0n, 0n, 0n, 0n); // clear

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterOwner, DROP, false)).toBe(0n);
    });

    test("returns unused loot to the creator on defeat", () => {
        // Small bonuses so the defeat payout fits the construct's SIGNA balance
        // and handleDefeat runs to completion (reaching the loot return).
        const {testbed} = deployConstructWithCharacter({
            maxHp: 100n,
            breachLimit: 100n,
            firstBloodBonus: 10_0000_0000n,
            finalBlowBonus: 20_0000_0000n,
        });
        // EOA attackers roll for drops too now, so force every band to miss
        // (flat +200 modifier vs. a threshold of 5 never triggers, regardless of
        // attack type or luck) — keeps this test isolated to "loot is unused".
        setDropModifiers(testbed, 200n, 200n, 200n);
        setDropToken(testbed, 0n, DROP, 5n, 1n);
        fundConstructWithToken(testbed, DROP, 100n);

        attack({testbed, signa: 550n, sender: Context.SenderAccount1});
        timeLapse({testbed, blocks: 2n});
        attack({testbed, signa: 550n, sender: Context.SenderAccount2});

        expect(testbed.getContractMemoryValue('isDefeated', Context.ThisContract)).toBe(1n);
        // the construct no longer holds the loot (it was returned)...
        expect(held(testbed, Context.ThisContract, DROP)).toBe(0n);
        // ...and the creator is made whole (funded 100, received 100 back → net 0)
        expect(held(testbed, Context.CreatorAccount, DROP, false)).toBe(0n);
    });

    test("only the creator can configure a drop slot", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        // a non-creator SETDROPTOKEN message is treated as an attack, not config
        attack({testbed, sender: Context.SenderAccount1, signa: 100n}); // establish nothing
        // attempt to configure as a non-creator
        testbed.sendTransactionAndGetResponse([{
            sender: Context.SenderAccount1,
            recipient: Context.ThisContract,
            amount: Context.ActivationFee,
            messageArr: [Context.Methods.SetDropToken, 0n | (200n << 8n), DROP, 3n],
        }], Context.ThisContract);
        fundConstructWithToken(testbed, DROP, 100n);

        // if the slot had been set, a character hit would drop; it must not
        attack({testbed, sender: characterAddress, signa: 100n});
        expect(held(testbed, characterOwner, DROP, false)).toBe(0n);
    });

    test("a hit below dropDamageThreshold does not roll for drops, even in a guaranteed band", () => {
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 3n); // threshold 200 → always drops, IF it rolls at all
        fundConstructWithToken(testbed, DROP, 100n);

        // 50 SIGNA deals 5 HP (< the default 10 HP threshold) and this construct's
        // default maxHp (50 000) is nowhere close to defeated, so it's a plain
        // sub-threshold hit, not a final blow.
        attack({testbed, sender: characterAddress, signa: 50n});

        expect(held(testbed, characterOwner, DROP, false)).toBe(0n);
    });

    test("a final blow always rolls for drops even if it deals less than dropDamageThreshold", () => {
        // maxHp 5, breachLimit 100 (no armor cap) → a 5 HP hit is lethal but
        // still under the default 10 HP drop-damage threshold.
        const {testbed, characterAddress, characterOwner} = deployConstructWithCharacter({maxHp: 5n, breachLimit: 100n});
        setDropToken(testbed, 0n, DROP, 200n, 1n); // guaranteed band once it rolls
        fundConstructWithToken(testbed, DROP, 100n);

        attack({testbed, sender: characterAddress, signa: 50n}); // 5 HP damage, one-shot kill

        expect(testbed.getContractMemoryValue('isDefeated', Context.ThisContract)).toBe(1n);
        expect(held(testbed, characterOwner, DROP, false)).toBe(1n);
    });

    test("SETDROPDAMAGETHRESHOLD raises the bar, excluding hits that used to qualify", () => {
        const base = deployConstructWithCharacter();
        setDropToken(base.testbed, 0n, DROP, 200n, 1n);
        fundConstructWithToken(base.testbed, DROP, 100n);
        attack({testbed: base.testbed, sender: base.characterAddress, signa: 100n}); // 10 HP == default threshold
        expect(held(base.testbed, base.characterOwner, DROP, false)).toBe(1n);

        const raised = deployConstructWithCharacter();
        setDropToken(raised.testbed, 0n, DROP, 200n, 1n);
        fundConstructWithToken(raised.testbed, DROP, 100n);
        setDropDamageThreshold(raised.testbed, 20n);
        attack({testbed: raised.testbed, sender: raised.characterAddress, signa: 100n}); // 10 HP < 20 now
        expect(held(raised.testbed, raised.characterOwner, DROP, false)).toBe(0n);
    });
});
