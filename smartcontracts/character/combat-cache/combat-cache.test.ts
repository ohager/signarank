import {describe, expect, test} from "vitest";
import {
    deployCharacter,
    getAttr,
    getPublicCombat,
    pokeCharacter,
    forgeBlocks,
    registerItemOnGamemasterRegistry,
    registerEffectOnGamemasterRegistry,
    setItemEffectOnGamemasterRegistry,
    fundCharacterWithToken,
    sendUseItem,
} from "../lib";
import {Context} from "../context";

// The combat profile (Maps.Combat) is a pure function of attributes, equipment
// aggregates, active status effects and the primary attack effect. Republishing
// its ~34 map ops on EVERY activation is wasteful, so publishProgression() gates
// it behind a dirty flag + a status-expiry watermark: it recomputes only when an
// input changed or a profile status effect has lapsed.

const POTION = 6200n; // +4 strength, timed status
const RING = 6201n;   // +3 strength, equipment aggregate

// Execution cost of one activation = incoming ActivationFee - balance delta
// (for paths that neither burn nor forward funds, e.g. a benign poke).
function pokeCost(testbed: any): bigint {
    const bal = () => testbed.getAccount(Context.CharacterAddress)?.balance ?? 0n;
    const before = bal();
    pokeCharacter(testbed);
    return Context.ActivationFee - (bal() - before);
}

describe("Combat profile republish caching", () => {
    test("skips the republish on a no-op activation but pays it when a status lapses", () => {
        const testbed = deployCharacter();
        registerItemOnGamemasterRegistry(testbed, {tokenId: POTION, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n});
        registerEffectOnGamemasterRegistry(testbed, {logicalId: 1n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.StatusEffect, bonusAbs: 4n, duration: 5n});
        setItemEffectOnGamemasterRegistry(testbed, {tokenId: POTION, slot: 0n, logicalEffectId: 1n});
        fundCharacterWithToken(testbed, {tokenId: POTION, quantity: 1n});

        const base = getAttr(testbed, Context.Attrs.Strength);
        sendUseItem(testbed, {tokenId: POTION}); // publishes profile with the buff + sets watermark
        expect(getPublicCombat(testbed, Context.CombatKeys.Strength)).toBe(base + 4n);

        // Poke while the buff is still active — nothing changed, so the profile
        // republish is skipped, yet the persisted profile is still correct.
        const costActive = pokeCost(testbed);
        expect(getPublicCombat(testbed, Context.CombatKeys.Strength)).toBe(base + 4n);

        // Let the status lapse, then poke: the watermark forces a republish that
        // drops the buff — even though no explicit input changed.
        forgeBlocks(testbed, 6);
        const costExpiry = pokeCost(testbed);
        expect(getPublicCombat(testbed, Context.CombatKeys.Strength)).toBe(base);

        // Now clean again (no active status) → subsequent poke skips.
        const costClean = pokeCost(testbed);
        expect(getPublicCombat(testbed, Context.CombatKeys.Strength)).toBe(base);

        // The republish costs materially more than a skip (the ~34-op profile write).
        expect(costExpiry).toBeGreaterThan(costActive);
        expect(costExpiry).toBeGreaterThan(costClean);
    });

    test("reflects an equip change made after skipped activations", () => {
        const testbed = deployCharacter();
        const base = getAttr(testbed, Context.Attrs.Strength);

        pokeCharacter(testbed); // clean → skips
        pokeCharacter(testbed); // clean → skips

        registerItemOnGamemasterRegistry(testbed, {tokenId: RING, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 1n});
        registerEffectOnGamemasterRegistry(testbed, {logicalId: 2n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.AggregateAbs, bonusAbs: 3n});
        setItemEffectOnGamemasterRegistry(testbed, {tokenId: RING, slot: 0n, logicalEffectId: 2n});
        fundCharacterWithToken(testbed, {tokenId: RING}); // equips on arrival → dirty

        expect(getPublicCombat(testbed, Context.CombatKeys.Strength)).toBe(base + 3n);
    });
});
