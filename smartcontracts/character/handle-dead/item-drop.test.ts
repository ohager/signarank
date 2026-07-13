import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharacterWithTrustedConstruct,
    getCharState,
    tokensSentTo,
    killCharacter,
    registerItemOnGamemasterRegistry,
    registerEffectOnGamemasterRegistry,
    setItemEffectOnGamemasterRegistry,
    fundCharacterWithToken,
    sendUseItem,
} from '../lib';

// Where a dead character's dropped item is returned (see #define constructorAccount).
const CONSTRUCTOR_ACCOUNT = 313131n;
const DROP_ITEM_ID = 5101n;   // the droppable inventory item
const REVIVE_ID = 5102n;      // used to resurrect between deaths in the loop

function heldQty(testbed: ReturnType<typeof deployCharacterWithTrustedConstruct>['testbed'], asset: bigint): bigint {
    return testbed.getContract(Context.CharacterAddress).tokens.find(t => t.asset === asset)?.quantity ?? 0n;
}

function registerDroppableConsumable(testbed: ReturnType<typeof deployCharacterWithTrustedConstruct>['testbed']) {
    registerItemOnGamemasterRegistry(testbed, { tokenId: DROP_ITEM_ID, itemType: Context.ItemType.Consumable, stackLimit: 50n, effectCount: 0n });
}

function registerReviveConsumable(testbed: ReturnType<typeof deployCharacterWithTrustedConstruct>['testbed']) {
    registerItemOnGamemasterRegistry(testbed, { tokenId: REVIVE_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
    registerEffectOnGamemasterRegistry(testbed, { logicalId: 90n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Revive, bonusRel: 100n });
    setItemEffectOnGamemasterRegistry(testbed, { tokenId: REVIVE_ID, slot: 0n, logicalEffectId: 90n });
}

describe('handleDead() — random item drop to constructorAccount', () => {
    // The DRIVING test: with the feature absent, no death ever drops an item, so
    // totalDrops stays 0 and this fails. Uses a kill/revive loop to sample many
    // deaths cheaply (weak RNG ⇒ statistical), asserting drops actually occur AND
    // that every drop is well-formed (exactly one unit, one slot freed).
    test('over many deaths, items are dropped to constructorAccount and every drop frees exactly one slot', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct({ constructorAccount: CONSTRUCTOR_ACCOUNT });
        registerDroppableConsumable(testbed);
        registerReviveConsumable(testbed);

        let totalDrops = 0n;
        let prevSent = 0n;
        const DEATHS = 64;

        for (let i = 0; i < DEATHS; i++) {
            if (heldQty(testbed, DROP_ITEM_ID) < 1n) {
                fundCharacterWithToken(testbed, { tokenId: DROP_ITEM_ID, quantity: 1n });
            }
            const heldBefore = heldQty(testbed, DROP_ITEM_ID);
            const slotsBefore = getCharState(testbed, Context.Vars.UsedInventorySlots);

            killCharacter(testbed, constructAddress);

            const droppedThisDeath = tokensSentTo(testbed, CONSTRUCTOR_ACCOUNT, DROP_ITEM_ID) - prevSent;
            prevSent += droppedThisDeath;

            // Mechanics hold on whichever deaths dropped: at most one unit left,
            // it went to constructorAccount, and exactly one slot was freed.
            expect(droppedThisDeath === 0n || droppedThisDeath === 1n).toBe(true);
            expect(heldBefore - heldQty(testbed, DROP_ITEM_ID)).toBe(droppedThisDeath);
            expect(slotsBefore - getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(droppedThisDeath);
            totalDrops += droppedThisDeath;

            // Resurrect for the next iteration.
            fundCharacterWithToken(testbed, { tokenId: REVIVE_ID, quantity: 1n });
            sendUseItem(testbed, { tokenId: REVIVE_ID });
            expect(getCharState(testbed, Context.Vars.IsDead)).toBe(0n);
        }

        // At ~20% base chance over 64 deaths, zero drops is astronomically
        // unlikely — a run with none means the drop is dead code.
        expect(totalDrops).toBeGreaterThanOrEqual(1n);
    });

    test('a death with an empty inventory drops nothing and does not touch slots', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct({ constructorAccount: CONSTRUCTOR_ACCOUNT });
        registerDroppableConsumable(testbed);

        killCharacter(testbed, constructAddress);

        expect(getCharState(testbed, Context.Vars.IsDead)).toBe(1n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        expect(tokensSentTo(testbed, CONSTRUCTOR_ACCOUNT, DROP_ITEM_ID)).toBe(0n);
    });

    test('the drop fires at most once per death — further dead-state activations drop nothing more', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct({ constructorAccount: CONSTRUCTOR_ACCOUNT });
        registerDroppableConsumable(testbed);
        fundCharacterWithToken(testbed, { tokenId: DROP_ITEM_ID, quantity: 5n });

        killCharacter(testbed, constructAddress);
        const sentAfterDeath = tokensSentTo(testbed, CONSTRUCTOR_ACCOUNT, DROP_ITEM_ID);
        expect(sentAfterDeath).toBeLessThanOrEqual(1n); // one death ⇒ at most one drop

        // Many more activations while still dead must not drop anything else.
        for (let i = 0; i < 10; i++) {
            killCharacter(testbed, constructAddress); // no-op re-damage while dead
        }

        expect(tokensSentTo(testbed, CONSTRUCTOR_ACCOUNT, DROP_ITEM_ID)).toBe(sentAfterDeath);
    });
});
