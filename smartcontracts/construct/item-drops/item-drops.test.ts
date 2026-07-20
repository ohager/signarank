import {describe, expect, test} from "vitest";
import {
    attack,
    deployConstructWithCharacter,
    fundConstructWithToken,
    setCharacterStats,
    setDropModifiers,
    setDropToken,
    setLuckFactor,
    timeLapse,
} from "../lib";
import {Context} from "../context";

// Step 5: item drops. A single luck-scaled D100 roll per character hit; for every
// configured slot, drop iff effectiveRoll < threshold. Drops go to the character
// only, supply-guarded by the construct's own balance. Bands are nested.
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
    test("drops the configured token to the character on a hit (guaranteed band)", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 3n); // threshold 200 → always drops
        fundConstructWithToken(testbed, DROP, 100n);

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterAddress, DROP)).toBe(3n);
    });

    test("does not drop when the roll misses the band", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        // threshold 0 with a first-blood hit (mod 0) and luck 0 → effectiveRoll ≥ 0, never < 0
        setDropToken(testbed, 0n, DROP, 0n, 3n);
        fundConstructWithToken(testbed, DROP, 100n);

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterAddress, DROP)).toBe(0n);
    });

    test("drops all qualifying slots together (nested bands)", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, RARE, 200n, 1n);
        setDropToken(testbed, 1n, DROP, 200n, 5n);
        fundConstructWithToken(testbed, RARE, 10n);
        fundConstructWithToken(testbed, DROP, 100n);

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterAddress, RARE)).toBe(1n);
        expect(held(testbed, characterAddress, DROP)).toBe(5n);
    });

    test("does not drop when the construct holds none of the token", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 3n); // would always drop
        // not funded → balance 0

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterAddress, DROP)).toBe(0n);
    });

    test("does not drop when the supply is below the drop quantity", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 5n);
        fundConstructWithToken(testbed, DROP, 2n); // holds < quantity

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterAddress, DROP)).toBe(0n);
    });

    test("does not drop for an EOA attacker", () => {
        const {testbed} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 3n);
        fundConstructWithToken(testbed, DROP, 100n);

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
        expect(held(noLuck.testbed, noLuck.characterAddress, DROP)).toBe(0n);

        const lucky = deployConstructWithCharacter();
        setDropModifiers(lucky.testbed, 15n, 15n, 15n);
        setDropToken(lucky.testbed, 0n, DROP, 5n, 1n);
        fundConstructWithToken(lucky.testbed, DROP, 100n);
        setCharacterStats(lucky.testbed, {luck: 110n});
        attack({testbed: lucky.testbed, sender: lucky.characterAddress, signa: 100n});
        expect(held(lucky.testbed, lucky.characterAddress, DROP)).toBe(1n);
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
        expect(held(f1.testbed, f1.characterAddress, DROP)).toBe(0n);

        const f20 = deployConstructWithCharacter();
        setDropModifiers(f20.testbed, 15n, 15n, 15n);
        setDropToken(f20.testbed, 0n, DROP, 5n, 1n);
        fundConstructWithToken(f20.testbed, DROP, 100n);
        setCharacterStats(f20.testbed, {luck: 10n});
        setLuckFactor(f20.testbed, 20n);
        attack({testbed: f20.testbed, sender: f20.characterAddress, signa: 100n});
        expect(held(f20.testbed, f20.characterAddress, DROP)).toBe(1n);
    });

    test("a final blow is favoured over a normal hit for drops", () => {
        // normal +200 (never drops at threshold 5), finalBlow −200 (always drops).
        const {testbed, characterAddress} = deployConstructWithCharacter({maxHp: 100n, breachLimit: 100n});
        setDropModifiers(testbed, 200n, 200n, -200n);
        setDropToken(testbed, 0n, DROP, 5n, 1n);
        fundConstructWithToken(testbed, DROP, 100n);

        // one-shot defeat → final blow
        attack({testbed, sender: characterAddress, signa: 1100n});

        expect(held(testbed, characterAddress, DROP)).toBe(1n);
    });

    test("clearing a slot (tokenId 0) stops its drops", () => {
        const {testbed, characterAddress} = deployConstructWithCharacter();
        setDropToken(testbed, 0n, DROP, 200n, 3n);
        fundConstructWithToken(testbed, DROP, 100n);
        setDropToken(testbed, 0n, 0n, 0n, 0n); // clear

        attack({testbed, sender: characterAddress, signa: 100n});

        expect(held(testbed, characterAddress, DROP)).toBe(0n);
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
        setDropToken(testbed, 0n, DROP, 200n, 1n);
        fundConstructWithToken(testbed, DROP, 100n);

        // defeat with EOAs → no character drop roll consumes the loot
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
        const {testbed, characterAddress} = deployConstructWithCharacter();
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
        expect(held(testbed, characterAddress, DROP)).toBe(0n);
    });
});
