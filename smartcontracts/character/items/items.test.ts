import { describe, expect, test } from 'vitest';
import { Context } from '../context';
import {
    deployCharacterWithGamemasterRegistry,
    deployCharacterWithTrustedConstruct,
    getCharState,
    getEquipBonusAbs,
    getEquipBonusRel,
    getStatusEffectExpiry,
    registerItemOnGamemasterRegistry,
    registerEffectOnGamemasterRegistry,
    setItemEffectOnGamemasterRegistry,
    sendUseItem,
    sendTransferItem,
    sendReceiveAttack,
    sendAttack,
    fundCharacterWithToken,
    getAttr,
    landOneHit,
} from '../lib';

const RING_ID = 5001n;
const HEAL_POTION_ID = 5002n;
const REVIVE_POTION_ID = 5003n;
const JUNK_TOKEN_ID = 5004n;
const CONSTRUCT_ID = 12345n;

// Damage mitigation (armor/dodge) means a single maxHp hit no longer reliably
// kills, so overwhelm armor and retry past dodges until dead.
function kill(testbed: ReturnType<typeof deployCharacterWithTrustedConstruct>['testbed'], constructAddress: bigint) {
    for (let i = 0; i < 64; i++) {
        if (getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress) === 1n) return;
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);
        sendReceiveAttack(testbed, { sender: constructAddress, rawDamage: maxHp * 4n });
    }
    throw new Error('kill: character never died');
}

// QNT of `asset` the Character actually sent back to `recipient`, summed over
// every outgoing token transfer to that account (0n if it never refunded).
// This proves a refund reached the *right* account with the *right* quantity —
// the sender's own account balance can't: the simulator never seeds senders,
// so a deposit drives their balance negative and back, netting to a useless 0.
function refundedTo(testbed: ReturnType<typeof deployCharacterWithGamemasterRegistry>['testbed'], recipient: bigint, asset: bigint): bigint {
    return (testbed.getTransactions() as { sender: bigint; recipient: bigint; tokens?: { asset: bigint; quantity: bigint }[] }[])
        .filter(tx => tx.sender === Context.CharacterAddress && tx.recipient === recipient)
        .flatMap(tx => tx.tokens ?? [])
        .filter(tok => tok.asset === asset)
        .reduce((sum, tok) => sum + tok.quantity, 0n);
}

const NON_OWNER = 777777n;

describe('receiveAssets() — automatic validation on arrival', () => {
    test('a registered Equipment item auto-applies its effects the moment it arrives, no USE_ITEM needed', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 2n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 1n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.AggregateAbs, bonusAbs: 2n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 2n, target: Context.EffectTarget.DamageTaken, mode: Context.EffectMode.AggregateRel, bonusRel: 10n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: RING_ID, slot: 0n, logicalEffectId: 1n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: RING_ID, slot: 1n, logicalEffectId: 2n });

        fundCharacterWithToken(testbed, { tokenId: RING_ID });

        expect(getEquipBonusAbs(testbed, Context.EffectTarget.Strength)).toBe(2n);
        expect(getEquipBonusRel(testbed, Context.EffectTarget.DamageTaken)).toBe(10n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(1n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
    });

    test('a registered Consumable is accepted into inventory but its effect does NOT fire on arrival', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 10n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Heal, bonusAbs: 5n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, slot: 0n, logicalEffectId: 10n });
        const hpBefore = getCharState(testbed, Context.Vars.CurrentHitpoints);

        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: 3n });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints)).toBe(hpBefore);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(3n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === HEAL_POTION_ID)?.quantity ?? 0n).toBe(3n);
    });

    test('unequipping via TRANSFER_ITEM reverts the aggregated bonuses and frees the slot', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 1n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.AggregateAbs, bonusAbs: 2n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: RING_ID, slot: 0n, logicalEffectId: 1n });
        fundCharacterWithToken(testbed, { tokenId: RING_ID });
        expect(getEquipBonusAbs(testbed, Context.EffectTarget.Strength)).toBe(2n);

        sendTransferItem(testbed, { itemId: RING_ID, recipientId: Context.OwnerAccount });

        expect(getEquipBonusAbs(testbed, Context.EffectTarget.Strength)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
    });

    test('an item below minLevel is refunded on arrival', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, minLevel: 5n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 1n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.AggregateAbs, bonusAbs: 2n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: RING_ID, slot: 0n, logicalEffectId: 1n });
        expect(getCharState(testbed, Context.Vars.Level)).toBe(1n);

        fundCharacterWithToken(testbed, { tokenId: RING_ID });

        expect(getEquipBonusAbs(testbed, Context.EffectTarget.Strength)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(0n);
    });

    test('a second deposit that would exceed stackLimit is refunded, the first stays', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });
        fundCharacterWithToken(testbed, { tokenId: RING_ID });
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(1n);

        fundCharacterWithToken(testbed, { tokenId: RING_ID });

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(1n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
    });

    test('a deposit that would exceed max inventory slots is refunded', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        const maxSlots = getCharState(testbed, Context.Vars.MaxInventorySlots);
        // Consumables stack into one deposit; equipment is one-per-slot and a
        // multi-unit deposit is bounced before the slot-limit check is reached.
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: maxSlots + 1n, effectCount: 0n });
        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: maxSlots });
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(maxSlots);

        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: 1n });

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(maxSlots);
    });

    test('an unregistered token is refunded outright, from any sender', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();

        fundCharacterWithToken(testbed, { tokenId: JUNK_TOKEN_ID, sender: 777777n });

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === JUNK_TOKEN_ID)?.quantity ?? 0n).toBe(0n);
    });

    test('a registered item from a non-owner is refunded and its effects never apply', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 1n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.AggregateAbs, bonusAbs: 2n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: RING_ID, slot: 0n, logicalEffectId: 1n });

        // A valid, registered item — but sent by someone other than the player.
        // The owner-gate in receiveAssets() must bounce it before any effect
        // fires or slot is consumed, so a third party can't force-equip.
        fundCharacterWithToken(testbed, { tokenId: RING_ID, sender: 777777n });

        expect(getEquipBonusAbs(testbed, Context.EffectTarget.Strength)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(0n);
    });

    test('the XP token is never treated as an item — no refund, no slot consumed', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();

        fundCharacterWithToken(testbed, { tokenId: Context.XpTokenId, quantity: 500n });

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === Context.XpTokenId)?.quantity ?? 0n).toBe(500n);
    });

    test('one item plus the XP token in a single deposit: the item is accepted and the XP kept — XP is not a second item', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });

        // RING is listed first (slot 0); XP rides along but never counts as a
        // second item, so the deposit is NOT treated as ambiguous.
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount,
            recipient: Context.CharacterAddress,
            amount: Context.ActivationFee,
            tokens: [
                { asset: RING_ID, quantity: 1n },
                { asset: Context.XpTokenId, quantity: 500n },
            ],
            messageArr: [0n, 0n, 0n, 0n],
        }], Context.CharacterAddress);

        const character = testbed.getContract(Context.CharacterAddress);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(1n);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
        expect(character.tokens.find(t => t.asset === Context.XpTokenId)?.quantity ?? 0n).toBe(500n);
    });

    test('a plain deposit carrying 2+ distinct assets is bounced back in full — a Character can never resolve which one was meant', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 0n });

        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount,
            recipient: Context.CharacterAddress,
            amount: Context.ActivationFee,
            tokens: [
                { asset: RING_ID, quantity: 1n },
                { asset: HEAL_POTION_ID, quantity: 3n },
            ],
            messageArr: [0n, 0n, 0n, 0n],
        }], Context.CharacterAddress);

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(0n);
        expect(character.tokens.find(t => t.asset === HEAL_POTION_ID)?.quantity ?? 0n).toBe(0n);
    });

});

describe('attack() — forwarding the attached asset to the construct', () => {
    const SIGNA = 10n;
    const forwardedSigna = SIGNA * 1_0000_0000n;

    test('SIGNA + one registered item: the item is forwarded to the construct, never shelved', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        // Give it an effect to prove forwarding does NOT auto-equip it.
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 1n, target: Context.EffectTarget.Strength, mode: Context.EffectMode.AggregateAbs, bonusAbs: 2n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: RING_ID, slot: 0n, logicalEffectId: 1n });

        sendAttack(testbed, { signa: SIGNA, constructId: CONSTRUCT_ID, extraTokens: [{ asset: RING_ID, quantity: 1n }] });

        const construct = testbed.getAccount(CONSTRUCT_ID);
        expect(construct?.tokens?.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
        expect(construct?.balance ?? 0n).toBe(forwardedSigna);
        // Not shelved: no slot, no effect, no holding, no refund to the player.
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        expect(getEquipBonusAbs(testbed, Context.EffectTarget.Strength)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(0n);
        expect(refundedTo(testbed, Context.OwnerAccount, RING_ID)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(1n);
    });

    test('SIGNA + several registered items: only the first listed is forwarded, the rest are refunded', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 0n });

        // The first token in the list is the one attack() forwards.
        sendAttack(testbed, { signa: SIGNA, constructId: CONSTRUCT_ID, extraTokens: [
            { asset: RING_ID, quantity: 1n },
            { asset: HEAL_POTION_ID, quantity: 3n },
        ] });

        const construct = testbed.getAccount(CONSTRUCT_ID);
        expect(construct?.tokens?.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
        expect(construct?.tokens?.find(t => t.asset === HEAL_POTION_ID)?.quantity ?? 0n).toBe(0n);
        expect(construct?.balance ?? 0n).toBe(forwardedSigna);
        // The extra is bounced to the sender, never shelved.
        expect(refundedTo(testbed, Context.OwnerAccount, HEAL_POTION_ID)).toBe(3n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(1n);
    });

    test('SIGNA + first asset registered, the rest unregistered: first forwarded, unregistered ones refunded', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });
        // HEAL_POTION_ID and JUNK_TOKEN_ID are deliberately NOT registered here.

        sendAttack(testbed, { signa: SIGNA, constructId: CONSTRUCT_ID, extraTokens: [
            { asset: RING_ID, quantity: 1n },
            { asset: HEAL_POTION_ID, quantity: 2n },
            { asset: JUNK_TOKEN_ID, quantity: 5n },
        ] });

        const construct = testbed.getAccount(CONSTRUCT_ID);
        expect(construct?.tokens?.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
        expect(construct?.balance ?? 0n).toBe(forwardedSigna);
        expect(refundedTo(testbed, Context.OwnerAccount, HEAL_POTION_ID)).toBe(2n);
        expect(refundedTo(testbed, Context.OwnerAccount, JUNK_TOKEN_ID)).toBe(5n);
        // The registration of the forwarded asset is irrelevant — attack() ships
        // slot 0 as-is; only the extras are validated (and here, bounced).
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
    });

    test('an ATTACK with an asset but no SIGNA is rejected: asset refunded, nothing forwarded, not committed', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });

        sendAttack(testbed, { signa: 0n, constructId: CONSTRUCT_ID, extraTokens: [{ asset: RING_ID, quantity: 1n }] });

        const construct = testbed.getAccount(CONSTRUCT_ID);
        expect(construct?.balance ?? 0n).toBe(0n);
        expect(construct?.tokens ?? []).toHaveLength(0);
        expect(refundedTo(testbed, Context.OwnerAccount, RING_ID)).toBe(1n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.Committed)).toBe(0n); // reroll stays available
    });

    test('an ATTACK whose SIGNA is below the construct activation amount is rejected: SIGNA and asset both refunded', () => {
        // The trusted-construct stand-in is a real deployed AT (activation 1 SIGNA),
        // so getActivationOf() returns a genuine threshold to test against.
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });
        const constructBalanceBefore = testbed.getAccount(constructAddress)?.balance ?? 0n;

        // Attach 0.5 SIGNA (net of the character's own activation fee) — below the
        // construct's 1 SIGNA activation, so it can never run.
        const belowActivation = 5000_0000n;
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount,
            recipient: Context.CharacterAddress,
            amount: Context.ActivationFee + belowActivation,
            tokens: [{ asset: RING_ID, quantity: 1n }],
            messageArr: [Context.Methods.Attack, constructAddress, 0n, 0n],
        }], Context.CharacterAddress);

        // Nothing reached the construct; both SIGNA and asset went back to the player.
        expect(testbed.getAccount(constructAddress)?.balance ?? 0n).toBe(constructBalanceBefore);
        expect(refundedTo(testbed, Context.OwnerAccount, RING_ID)).toBe(1n);
        const signaRefund = testbed.getTransactions().find(tx =>
            tx.sender === Context.CharacterAddress && tx.recipient === Context.OwnerAccount && tx.amount === belowActivation,
        );
        expect(signaRefund).toBeDefined();
        expect(getCharState(testbed, Context.Vars.Committed, Context.CharacterAddress)).toBe(0n);
    });
});

describe('receiveAssets() — refunds are returned to the sender', () => {
    test('a rejected item is sent back to the exact account that deposited it, not the owner', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 3n, sender: NON_OWNER });

        expect(refundedTo(testbed, NON_OWNER, RING_ID)).toBe(3n);
        expect(refundedTo(testbed, Context.OwnerAccount, RING_ID)).toBe(0n);
    });

    test('the refund carries the full deposited quantity, unchanged', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        // Unregistered from the owner: refunded via receiveAsset()'s legitimacy check.
        fundCharacterWithToken(testbed, { tokenId: JUNK_TOKEN_ID, quantity: 42n });

        expect(refundedTo(testbed, Context.OwnerAccount, JUNK_TOKEN_ID)).toBe(42n);
    });

    test('an item below minLevel is refunded to the owner in full', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, minLevel: 5n, effectCount: 0n });

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 2n });

        expect(refundedTo(testbed, Context.OwnerAccount, RING_ID)).toBe(2n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
    });

    test('a second deposit that breaches stackLimit refunds only the surplus deposit; the first stays held', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });
        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n }); // accepted, no refund
        expect(refundedTo(testbed, Context.OwnerAccount, RING_ID)).toBe(0n);

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n }); // breaches stackLimit

        expect(refundedTo(testbed, Context.OwnerAccount, RING_ID)).toBe(1n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
    });

    test('every extra asset beyond the first is refunded to the sender with its own quantity', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 0n });

        // Slots 1-3 are always rejected regardless of how slot 0 is resolved,
        // so this asserts the per-slot refund routing/quantities only.
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount,
            recipient: Context.CharacterAddress,
            amount: Context.ActivationFee,
            tokens: [
                { asset: RING_ID, quantity: 1n },
                { asset: HEAL_POTION_ID, quantity: 3n },
                { asset: JUNK_TOKEN_ID, quantity: 5n },
            ],
            messageArr: [0n, 0n, 0n, 0n],
        }], Context.CharacterAddress);

        expect(refundedTo(testbed, Context.OwnerAccount, HEAL_POTION_ID)).toBe(3n);
        expect(refundedTo(testbed, Context.OwnerAccount, JUNK_TOKEN_ID)).toBe(5n);
    });

    test('a non-owner depositing several assets gets every one bounced back to them', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 0n });

        testbed.sendTransactionAndGetResponse([{
            sender: NON_OWNER,
            recipient: Context.CharacterAddress,
            amount: Context.ActivationFee,
            tokens: [
                { asset: RING_ID, quantity: 1n },
                { asset: HEAL_POTION_ID, quantity: 2n },
            ],
            messageArr: [0n, 0n, 0n, 0n],
        }], Context.CharacterAddress);

        expect(refundedTo(testbed, NON_OWNER, RING_ID)).toBe(1n);
        expect(refundedTo(testbed, NON_OWNER, HEAL_POTION_ID)).toBe(2n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
    });

    test('the XP token is never refunded — kept by the Character even from a non-owner (secondary market)', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();

        fundCharacterWithToken(testbed, { tokenId: Context.XpTokenId, quantity: 500n, sender: NON_OWNER });

        expect(refundedTo(testbed, NON_OWNER, Context.XpTokenId)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === Context.XpTokenId)?.quantity ?? 0n).toBe(500n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
    });

    test('an accepted item produces no refund transaction at all', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: RING_ID, itemType: Context.ItemType.Equipment, stackLimit: 1n, effectCount: 0n });

        fundCharacterWithToken(testbed, { tokenId: RING_ID, quantity: 1n });

        expect(refundedTo(testbed, Context.OwnerAccount, RING_ID)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === RING_ID)?.quantity ?? 0n).toBe(1n);
    });
});

describe('useItem() — attaching the item in the same transaction', () => {
    test('does not leak a phantom inventory slot when the item is attached alongside USE_ITEM', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 10n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Heal, bonusAbs: 5n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, slot: 0n, logicalEffectId: 10n });

        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount,
            recipient: Context.CharacterAddress,
            amount: Context.ActivationFee,
            tokens: [{ asset: HEAL_POTION_ID, quantity: 1n }],
            messageArr: [Context.Methods.UseItem, HEAL_POTION_ID, 0n, 0n],
        }], Context.CharacterAddress);

        // receiveAssets() credits the slot first, useItem() burns it and
        // decrements the same slot back out — net zero, not a leaked +1.
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === HEAL_POTION_ID)?.quantity ?? 0n).toBe(0n);
    });
});

describe('useItem() — consuming an already-held Consumable', () => {
    test('burns 1 unit and applies its effect when alive', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 10n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Heal, bonusAbs: 1000000n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, slot: 0n, logicalEffectId: 10n });
        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID });
        sendReceiveAttack(testbed, { sender: constructAddress, rawDamage: 10n });
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);

        sendUseItem(testbed, { tokenId: HEAL_POTION_ID, characterAddress: Context.CharacterAddress });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(maxHp);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots, Context.CharacterAddress)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === HEAL_POTION_ID)?.quantity ?? 0n).toBe(0n);
    });

    test('a percentage HEAL potion (bonusRel) restores that % of max HP', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 10n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Heal, bonusRel: 25n }); // heal 25% of max
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, slot: 0n, logicalEffectId: 10n });
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);
        // Wound to ~half HP (deterministic net, past armor/dodge) so the 25% heal
        // has headroom below the cap; read the actual wounded HP to assert against.
        const armor = getAttr(testbed, Context.Attrs.Stamina) * Context.DamageMitigation.ArmorPerStamina;
        landOneHit(testbed, constructAddress, armor + maxHp / 2n);
        const wounded = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);
        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID });

        sendUseItem(testbed, { tokenId: HEAL_POTION_ID, characterAddress: Context.CharacterAddress });

        // wounded + floor(maxHp * 25 / 100), still below the cap.
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(wounded + (maxHp * 25n) / 100n);
    });

    test('having 5 potions in inventory only consumes 1 per USE_ITEM call — the effect fires once', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 10n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Heal, bonusAbs: 5n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, slot: 0n, logicalEffectId: 10n });
        // Wound deterministically (net 20, past armor/dodge) so a 5-HP heal has headroom.
        const armor = getAttr(testbed, Context.Attrs.Stamina) * Context.DamageMitigation.ArmorPerStamina;
        landOneHit(testbed, constructAddress, armor + 20n);
        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID, quantity: 5n });
        const hpBefore = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        sendUseItem(testbed, { tokenId: HEAL_POTION_ID, characterAddress: Context.CharacterAddress });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(hpBefore + 5n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots, Context.CharacterAddress)).toBe(4n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === HEAL_POTION_ID)?.quantity ?? 0n).toBe(4n);
    });

    test('a HEAL potion used while dead is left untouched in inventory, no HP change', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 10n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Heal, bonusAbs: 1000000n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, slot: 0n, logicalEffectId: 10n });
        kill(testbed, constructAddress);
        // Deposit AFTER death so the death item-drop can't remove this potion.
        fundCharacterWithToken(testbed, { tokenId: HEAL_POTION_ID });

        sendUseItem(testbed, { tokenId: HEAL_POTION_ID, characterAddress: Context.CharacterAddress });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(0n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === HEAL_POTION_ID)?.quantity ?? 0n).toBe(1n);
        expect(getCharState(testbed, Context.Vars.UsedInventorySlots, Context.CharacterAddress)).toBe(1n);
    });

    test('a percentage REVIVE potion (bonusRel) restores HP to that % of max, and is burned', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        registerItemOnGamemasterRegistry(testbed, { tokenId: REVIVE_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 11n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Revive, bonusRel: 50n }); // 50% of max
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: REVIVE_POTION_ID, slot: 0n, logicalEffectId: 11n });
        kill(testbed, constructAddress);
        expect(getCharState(testbed, Context.Vars.DeathPenaltyApplied, Context.CharacterAddress)).toBe(1n);
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);
        // Deposit AFTER death so the death item-drop can't remove this potion.
        fundCharacterWithToken(testbed, { tokenId: REVIVE_POTION_ID });

        sendUseItem(testbed, { tokenId: REVIVE_POTION_ID, characterAddress: Context.CharacterAddress });

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.DeathPenaltyApplied, Context.CharacterAddress)).toBe(0n);
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(maxHp / 2n);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === REVIVE_POTION_ID)?.quantity ?? 0n).toBe(0n);
    });

    test('a flat REVIVE potion (bonusAbs) restores exactly that many HP', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        registerItemOnGamemasterRegistry(testbed, { tokenId: REVIVE_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 11n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Revive, bonusAbs: 50n }); // flat 50 HP
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: REVIVE_POTION_ID, slot: 0n, logicalEffectId: 11n });
        kill(testbed, constructAddress);
        // Deposit AFTER death so the death item-drop can't remove this potion.
        fundCharacterWithToken(testbed, { tokenId: REVIVE_POTION_ID });

        sendUseItem(testbed, { tokenId: REVIVE_POTION_ID, characterAddress: Context.CharacterAddress });

        expect(getCharState(testbed, Context.Vars.IsDead, Context.CharacterAddress)).toBe(0n);
        // maxHp is 100–150, so 50 flat is always below the cap.
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(50n);
    });

    test('a combined REVIVE potion restores flat + percentage of max HP', () => {
        const { testbed, constructAddress } = deployCharacterWithTrustedConstruct();
        registerItemOnGamemasterRegistry(testbed, { tokenId: REVIVE_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 11n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Revive, bonusAbs: 20n, bonusRel: 30n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: REVIVE_POTION_ID, slot: 0n, logicalEffectId: 11n });
        kill(testbed, constructAddress);
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, Context.CharacterAddress);
        // Deposit AFTER death so the death item-drop can't remove this potion.
        fundCharacterWithToken(testbed, { tokenId: REVIVE_POTION_ID });

        sendUseItem(testbed, { tokenId: REVIVE_POTION_ID, characterAddress: Context.CharacterAddress });

        // Same integer math as the contract: 20 + floor(maxHp * 30 / 100).
        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(20n + (maxHp * 30n) / 100n);
    });

    test('a REVIVE potion used while alive is left untouched in inventory, no state change', () => {
        const { testbed } = deployCharacterWithTrustedConstruct();
        registerItemOnGamemasterRegistry(testbed, { tokenId: REVIVE_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 11n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Revive, bonusRel: 50n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: REVIVE_POTION_ID, slot: 0n, logicalEffectId: 11n });
        fundCharacterWithToken(testbed, { tokenId: REVIVE_POTION_ID });
        const hpBefore = getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress);

        sendUseItem(testbed, { tokenId: REVIVE_POTION_ID, characterAddress: Context.CharacterAddress });

        expect(getCharState(testbed, Context.Vars.CurrentHitpoints, Context.CharacterAddress)).toBe(hpBefore);
        const character = testbed.getContract(Context.CharacterAddress);
        expect(character.tokens.find(t => t.asset === REVIVE_POTION_ID)?.quantity ?? 0n).toBe(1n);
    });

    test('USE_ITEM on a token not held at all is a no-op', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        registerItemOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 10n, target: Context.EffectTarget.Hp, mode: Context.EffectMode.Heal, bonusAbs: 5n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: HEAL_POTION_ID, slot: 0n, logicalEffectId: 10n });

        expect(() => sendUseItem(testbed, { tokenId: HEAL_POTION_ID, characterAddress: Context.CharacterAddress })).not.toThrow();

        expect(getCharState(testbed, Context.Vars.UsedInventorySlots, Context.CharacterAddress)).toBe(0n);
    });
});

describe('useItem() — status effects', () => {
    test('a STATUS_EFFECT item writes an expiry block relative to the current height', () => {
        const { testbed } = deployCharacterWithGamemasterRegistry();
        const STATUS_TOKEN_ID = 5005n;
        registerItemOnGamemasterRegistry(testbed, { tokenId: STATUS_TOKEN_ID, itemType: Context.ItemType.Consumable, stackLimit: 10n, effectCount: 1n });
        registerEffectOnGamemasterRegistry(testbed, { logicalId: 12n, target: 99n, mode: Context.EffectMode.StatusEffect, duration: 10n });
        setItemEffectOnGamemasterRegistry(testbed, { tokenId: STATUS_TOKEN_ID, slot: 0n, logicalEffectId: 12n });
        fundCharacterWithToken(testbed, { tokenId: STATUS_TOKEN_ID });

        sendUseItem(testbed, { tokenId: STATUS_TOKEN_ID });

        expect(getStatusEffectExpiry(testbed, 99n)).toBeGreaterThan(0n);
    });
});
