import type { SimulatorTestbed } from 'signum-smartc-testbed';
import { SimulatorTestbed as Testbed } from 'signum-smartc-testbed';
import { join } from 'path';
import { Context } from './context';

const CONSTRUCT_STANDIN_PATH = join(__dirname, '..', 'character-account-registry', 'character-account-registry.contract.smart.c');

// ---- REGISTRY-AS-CONFIG DEPLOY BUILDER ----
// The Character sources its identities (xp token, constructor account, char
// registry) from the gamemaster registry at init() — so EVERY deploy must
// stand up a *seeded* gamemaster registry BEFORE the Character is activated,
// mirroring the mandatory on-chain deploy ordering. These low-level pieces
// compose into the public deploy* helpers below.

export type DeployOpts = {
    creator?: bigint;
    address?: bigint;
    xpTokenId?: bigint;
    // Trusted construct issuer, cached by the Character at init(). Defaults to
    // unset (0), which also doubles as the drop destination on death.
    constructorAccount?: bigint;
};

// Bootstrap-funds + deploys the gamemaster registry at the hardcoded
// GAMEMASTER_REGISTRY address so it can receive the seed txs below.
function newGamemasterTestbed(): SimulatorTestbed {
    const testbed = new Testbed([{
        blockheight: 1,
        amount: 100_0000_0000n,
        sender: Context.OwnerAccount,
        recipient: Context.GamemasterRegistryAddress,
    }]).loadContract(Context.GamemasterRegistryPath, { contractId: Context.GamemasterRegistryAddress });
    testbed.runScenario();
    return testbed;
}

export function setXpTokenOnGamemasterRegistry(testbed: SimulatorTestbed, xpTokenId: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount, // gamemaster == the registry's creator (555n)
        recipient: Context.GamemasterRegistryAddress,
        amount: 1_0000_0000n,
        messageArr: [Context.GamemasterMethods.SetXpToken, xpTokenId, 0n, 0n],
    }], Context.GamemasterRegistryAddress);
}

export function setConstructorAccountOnGamemasterRegistry(testbed: SimulatorTestbed, account: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.GamemasterRegistryAddress,
        amount: 1_0000_0000n,
        messageArr: [Context.GamemasterMethods.SetConstructorAccount, account, 0n, 0n],
    }], Context.GamemasterRegistryAddress);
}

export function setCharRegistryOnGamemasterRegistry(testbed: SimulatorTestbed, charRegistry: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.GamemasterRegistryAddress,
        amount: 1_0000_0000n,
        messageArr: [Context.GamemasterMethods.SetCharRegistry, charRegistry, 0n, 0n],
    }], Context.GamemasterRegistryAddress);
}

// Seeds the three identities the Character reads at init(). charRegistry
// defaults to CharRegistryAddress (getActivationOf on an undeployed address is
// 0, so the registration send is a harmless no-op when no char registry is up).
// constructorAccount is only seeded when non-zero — an unset key reads 0.
function seedGamemasterConfig(testbed: SimulatorTestbed, opts: {
    xpTokenId?: bigint;
    constructorAccount?: bigint;
    charRegistry?: bigint;
} = {}) {
    setXpTokenOnGamemasterRegistry(testbed, opts.xpTokenId ?? Context.XpTokenId);
    if ((opts.constructorAccount ?? 0n) !== 0n) {
        setConstructorAccountOnGamemasterRegistry(testbed, opts.constructorAccount!);
    }
    setCharRegistryOnGamemasterRegistry(testbed, opts.charRegistry ?? Context.CharRegistryAddress);
}

// Loads + funds the Character into an existing testbed whose gamemaster registry
// is ALREADY seeded, triggering its (once-only) init(). Optionally nudges the
// char-account registry afterwards so it consumes the queued registration
// message (the simulator only re-activates a contract on a block where it gets
// a qualifying tx).
function activateCharacter(testbed: SimulatorTestbed, opts: DeployOpts = {}, nudgeCharRegistry = false) {
    const characterAddress = opts.address ?? Context.CharacterAddress;
    testbed.loadContract(Context.ContractPath, {
        creator: opts.creator ?? Context.OwnerAccount,
        contractId: characterAddress,
    });
    testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: characterAddress,
        amount: 200_0000_0000n,
    }], characterAddress);
    if (nudgeCharRegistry) {
        testbed.sendTransactionAndGetResponse([{
            sender: Context.OwnerAccount,
            recipient: Context.CharRegistryAddress,
            amount: 1_0000_0000n,
        }], Context.CharRegistryAddress);
    }
    return testbed;
}

// Codehash is a pure function of source. With identities now registry-sourced
// (no initializers), the codehash is STABLE — the exact value the dApp verifies.
function characterCodeHash(): bigint {
    return new Testbed().loadContract(Context.ContractPath).getContract().codeHashId;
}

export function deployCharacter(opts: DeployOpts = {}) {
    const testbed = newGamemasterTestbed();
    seedGamemasterConfig(testbed, { xpTokenId: opts.xpTokenId, constructorAccount: opts.constructorAccount });
    return activateCharacter(testbed, opts);
}

// Deploys a seeded gamemaster registry AND a real character-account-registry at
// the hardcoded addresses, configuring the char registry's trusted character
// hash — required BEFORE any character is deployed, since init()'s registration
// message is one-shot and silently lost forever if the trust hash isn't already
// configured when it fires. Returns the bare testbed; use deployCharacterOnRegistry
// to add characters to it.
export function deployCharRegistry(opts: { xpTokenId?: bigint } = {}) {
    const testbed = newGamemasterTestbed();
    seedGamemasterConfig(testbed, { xpTokenId: opts.xpTokenId, charRegistry: Context.CharRegistryAddress });

    testbed.loadContract(Context.CharRegistryPath, { contractId: Context.CharRegistryAddress });
    testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount, // registry's creator defaults to 555n
        recipient: Context.CharRegistryAddress,
        amount: 1_0000_0000n,
        messageArr: [1n, characterCodeHash(), 0n, 0n], // M_SET_CHARACTER_HASH
    }], Context.CharRegistryAddress);

    return testbed;
}

// Deploys+funds a character on a testbed whose gamemaster + char registries are
// already configured (see deployCharRegistry) — init() reads its identities and
// its registration message is picked up for real.
export function deployCharacterOnRegistry(testbed: SimulatorTestbed, opts: DeployOpts = {}) {
    return activateCharacter(testbed, opts, true);
}

// Convenience wrapper for the common single-character case.
export function deployCharacterWithCharRegistry(opts: DeployOpts = {}) {
    const testbed = deployCharRegistry({ xpTokenId: opts.xpTokenId });
    deployCharacterOnRegistry(testbed, opts);
    return testbed;
}

// Deploys character-account-registry + gamemaster-registry + a construct
// stand-in + the character, with BOTH registries' trust fully configured —
// needed for scenarios that require a real death (via a trusted construct's
// DEDUCT_HITPOINTS) AND registry-observable effects (e.g. seppuku, which now
// requires isDead == TRUE) in the same test.
export function deployCharacterWithRegistries(opts: DeployOpts & { constructStandInAddress?: bigint } = {}) {
    const constructAddress = opts.constructStandInAddress ?? 888n;

    const testbed = deployCharRegistry({ xpTokenId: opts.xpTokenId });
    testbed.loadContract(CONSTRUCT_STANDIN_PATH, { contractId: constructAddress });
    const constructStandIn = testbed.getContract(constructAddress);

    deployCharacterOnRegistry(testbed, opts);
    setConstructHashOnGamemasterRegistry(testbed, constructStandIn.codeHashId);

    return { testbed, constructStandIn, constructAddress };
}

// Deploys the character plus a seeded gamemaster-registry at the hardcoded
// GAMEMASTER_REGISTRY address, and a distinct "construct" stand-in contract
// (any different bytecode works — only its codehash matters) so tests can
// exercise the real codehash-comparison path in senderIsConstruct().
export function deployCharacterWithGamemasterRegistry(opts: DeployOpts & { constructStandInAddress?: bigint } = {}) {
    const constructAddress = opts.constructStandInAddress ?? 888n;

    const testbed = newGamemasterTestbed();
    seedGamemasterConfig(testbed, { xpTokenId: opts.xpTokenId, constructorAccount: opts.constructorAccount });
    // character-account-registry.contract.smart.c is used purely as a distinct
    // bytecode to stand in for "the construct" — only its codehash matters here.
    testbed.loadContract(CONSTRUCT_STANDIN_PATH, { contractId: constructAddress });
    const constructStandIn = testbed.getContract(constructAddress);

    activateCharacter(testbed, opts);
    return { testbed, constructStandIn, constructAddress };
}

// Convenience wrapper: deploys character + gamemaster-registry + construct
// stand-in, AND registers the stand-in's codehash as the trusted construct
// hash via the real M_SET_CONSTRUCT_HASH flow — the fully "correctly
// configured" scenario senderIsConstruct() is meant to authorize.
export function deployCharacterWithTrustedConstruct(opts: DeployOpts & { constructStandInAddress?: bigint } = {}) {
    const result = deployCharacterWithGamemasterRegistry(opts);
    setConstructHashOnGamemasterRegistry(result.testbed, result.constructStandIn!.codeHashId);
    return result;
}

// Total QNT of `asset` the Character sent to `recipient`, summed across every
// outgoing token transfer (0n if none). Same technique as items.test.ts's
// refundedTo, but for any destination — used to observe death-drops.
export function tokensSentTo(testbed: SimulatorTestbed, recipient: bigint, asset: bigint, characterAddress = Context.CharacterAddress): bigint {
    return (testbed.getTransactions() as { sender: bigint; recipient: bigint; tokens?: { asset: bigint; quantity: bigint }[] }[])
        .filter(tx => tx.sender === characterAddress && tx.recipient === recipient)
        .flatMap(tx => tx.tokens ?? [])
        .filter(tok => tok.asset === asset)
        .reduce((sum, tok) => sum + tok.quantity, 0n);
}

// Kills the Character via the trusted construct's DEDUCT_HITPOINTS (the only
// authorized death path). Damage mitigation (dodge + armor) means a single
// maxHp hit no longer reliably kills, so send overwhelming raw damage and retry
// past dodges until dead. Overwhelming raw (4×maxHp) always overcomes armor.
export function killCharacter(testbed: SimulatorTestbed, constructAddress: bigint, characterAddress = Context.CharacterAddress) {
    for (let i = 0; i < 64; i++) {
        if (getCharState(testbed, Context.Vars.IsDead, characterAddress) === 1n) return;
        const maxHp = getCharState(testbed, Context.Vars.MaxHitpoints, characterAddress);
        sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: maxHp * 4n });
    }
    throw new Error('killCharacter: character never died after 64 overwhelming hits');
}

// Sends raw DEDUCT_HITPOINTS hits until exactly one LANDS (dodge chance < 100%,
// so this terminates quickly), returning that landing hit's HP delta. Lets a
// test assert the deterministic armor math (delta === raw - stamina*armor)
// without depending on which hits the RNG dodges.
export function landOneHit(testbed: SimulatorTestbed, constructAddress: bigint, rawDamage: bigint, characterAddress = Context.CharacterAddress): bigint {
    for (let i = 0; i < 64; i++) {
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, characterAddress);
        sendDeductHitpoints(testbed, { sender: constructAddress, hitpoints: rawDamage });
        const after = getCharState(testbed, Context.Vars.CurrentHitpoints, characterAddress);
        if (after < before) return before - after;
    }
    throw new Error('landOneHit: no hit landed after 64 tries');
}

// Grinds the Character up `points` levels (one skill point each) by funding the
// XP required to REACH level 1+points, then allocates every earned point into
// `attrIndex`. Used to build a character with, e.g., high dexterity for dodge.
export function grindSkillPointsInto(testbed: SimulatorTestbed, attrIndex: bigint, points: number, characterAddress = Context.CharacterAddress) {
    // Cumulative XP to reach level L is 1000 * (L-1)*L/2; here L = 1 + points.
    const L = BigInt(1 + points);
    const xpNeeded = (Context.LevelXpBase * (L - 1n) * L) / 2n;
    fundCharacterWithXp(testbed, { quantity: xpNeeded, characterAddress });
    for (let i = 0; i < points; i++) {
        sendAllocateSkillpoint(testbed, attrIndex);
    }
}

export function getCharState(testbed: SimulatorTestbed, varName: string, address?: bigint): bigint {
    return testbed.getContractMemoryValue(varName, address) ?? 0n;
}

// Reads the publicly-published progression sheet (level / skill points) from the
// character's map — what the dApp and a future v2 (pull-migration) would read.
export function getPublicLevel(testbed: SimulatorTestbed, address = Context.CharacterAddress): bigint {
    return testbed.getContractMapValue(Context.Maps.Progression, Context.ProgressionKeys.Level, address) ?? 0n;
}

export function getPublicSkillPoints(testbed: SimulatorTestbed, address = Context.CharacterAddress): bigint {
    return testbed.getContractMapValue(Context.Maps.Progression, Context.ProgressionKeys.SkillPoints, address) ?? 0n;
}

export function getAttr(testbed: SimulatorTestbed, attrKey2: bigint): bigint {
    return testbed.getContractMapValue(Context.Maps.Attributes, attrKey2);
}

// Advances the chain by `n` blocks (e.g. to let a timed status effect expire).
export function forgeBlocks(testbed: SimulatorTestbed, n: number) {
    for (let i = 0; i < n; i++) testbed.blockchain.forgeBlock();
}

// A benign owner activation that just re-runs main() — republishing the public
// sheet/profile so lazily-expired status effects drop out of the read.
export function pokeCharacter(testbed: SimulatorTestbed, address = Context.CharacterAddress) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: address,
        amount: Context.ActivationFee,
        messageArr: [0n, 0n, 0n, 0n],
    }], address);
}

// Public combat profile (Maps.Combat) — the effective stats the construct reads.
export function getPublicCombat(testbed: SimulatorTestbed, combatKey2: bigint, address = Context.CharacterAddress): bigint {
    return testbed.getContractMapValue(Context.Maps.Combat, combatKey2, address) ?? 0n;
}

export function getAllAttrs(testbed: SimulatorTestbed) {
    return {
        strength: getAttr(testbed, Context.Attrs.Strength),
        stamina: getAttr(testbed, Context.Attrs.Stamina),
        dexterity: getAttr(testbed, Context.Attrs.Dexterity),
        luck: getAttr(testbed, Context.Attrs.Luck),
        willpower: getAttr(testbed, Context.Attrs.Willpower),
    };
}

export function sumAttrs(testbed: SimulatorTestbed): bigint {
    const a = getAllAttrs(testbed);
    return a.strength + a.stamina + a.dexterity + a.luck + a.willpower;
}

export function sendAllocateSkillpoint(testbed: SimulatorTestbed, attrIndex: bigint, sender: bigint = Context.OwnerAccount) {
    const characterAddress = Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.AllocateSkillpoint, attrIndex, 0n, 0n],
    }], characterAddress);
}

export function sendAttack(testbed: SimulatorTestbed, opts: {
    signa: bigint;
    constructId: bigint;
    quantity?: bigint;
    assetId?: bigint;
    sender?: bigint;
    characterAddress?: bigint;
    // Extra assets attached to the SAME transaction beyond the one attack()
    // itself forwards (assetId/quantity) — exercises receiveAssets() still
    // validating everything else in a multi-asset ATTACK tx.
    extraTokens?: { asset: bigint; quantity: bigint }[];
}) {
    const characterAddress = opts.characterAddress ?? Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: opts.signa * 1_0000_0000n + Context.ActivationFee,
        tokens: opts.extraTokens,
        messageArr: [Context.Methods.Attack, opts.constructId, opts.quantity ?? 0n, opts.assetId ?? 0n],
    }], characterAddress);
}

export function sendTransferItem(testbed: SimulatorTestbed, opts: {
    itemId: bigint;
    recipientId: bigint;
    sender?: bigint;
}) {
    const characterAddress = Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.TransferItem, opts.itemId, opts.recipientId, 0n],
    }], characterAddress);
}

export function sendRefund(testbed: SimulatorTestbed, opts: { sender?: bigint } = {}) {
    const characterAddress = Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.Refund, 0n, 0n, 0n],
    }], characterAddress);
}

export function sendDeductHitpoints(testbed: SimulatorTestbed, opts: { sender: bigint; hitpoints: bigint }) {
    const characterAddress = Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        messageArr: [Context.ConstructMethods.DeductHitpoints, opts.hitpoints, 0n, 0n],
    }], characterAddress);
}

// COMBAT(rawDamage, effectId, duration): deduct HP and apply a timed status.
export function sendCombat(testbed: SimulatorTestbed, opts: { sender: bigint; rawDamage: bigint; effectId?: bigint; duration?: bigint; characterAddress?: bigint }) {
    const characterAddress = opts.characterAddress ?? Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        messageArr: [Context.ConstructMethods.Combat, opts.rawDamage, opts.effectId ?? 0n, opts.duration ?? 0n],
    }], characterAddress);
}

// Retries a pure-damage COMBAT past dodges and returns the landing hit's HP delta.
export function landOneCombat(testbed: SimulatorTestbed, constructAddress: bigint, rawDamage: bigint, characterAddress = Context.CharacterAddress): bigint {
    for (let i = 0; i < 64; i++) {
        const before = getCharState(testbed, Context.Vars.CurrentHitpoints, characterAddress);
        sendCombat(testbed, { sender: constructAddress, rawDamage, characterAddress });
        const after = getCharState(testbed, Context.Vars.CurrentHitpoints, characterAddress);
        if (after < before) return before - after;
    }
    throw new Error('landOneCombat: no hit landed after 64 tries');
}

// Funds the character with a token WITHOUT triggering anything — mirrors how
// any plain token deposit lands in the contract's balance regardless of
// message content.
export function fundCharacterWithToken(testbed: SimulatorTestbed, opts: {
    sender?: bigint;
    tokenId: bigint;
    quantity?: bigint;
}) {
    const characterAddress = Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        tokens: [{ asset: opts.tokenId, quantity: opts.quantity ?? 1n }],
        messageArr: [0n, 0n, 0n, 0n],
    }], characterAddress);
}

// Simulates a Construct paying out XP tokens after an attack — a plain
// deposit with no message, exactly like fundCharacterWithToken but defaulted
// to the XP token id and triggering checkLevelUp() via this activation.
export function fundCharacterWithXp(testbed: SimulatorTestbed, opts: {
    sender?: bigint;
    quantity: bigint;
    characterAddress?: bigint;
}) {
    const characterAddress = opts.characterAddress ?? Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        tokens: [{ asset: Context.XpTokenId, quantity: opts.quantity }],
        messageArr: [0n, 0n, 0n, 0n],
    }], characterAddress);
}

// Calls USE_ITEM — a message-only call, no attached tokens. Items are
// validated/accepted into inventory automatically on arrival (see
// receiveAssets() in the contract); USE_ITEM only burns an already-held
// Consumable and applies its effect, it no longer needs anything attached.
export function sendUseItem(testbed: SimulatorTestbed, opts: {
    tokenId: bigint;
    sender?: bigint;
    characterAddress?: bigint;
}) {
    const characterAddress = opts.characterAddress ?? Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.UseItem, opts.tokenId, 0n, 0n],
    }], characterAddress);
}

// The gamemaster-registry stores effects at key1 = RegistryBase + logical id
// (callers must add the offset themselves — see gamemaster-registry-design.md).
export function effectId(logicalId: bigint): bigint {
    return Context.RegistryBase + Context.MinEffectId + logicalId;
}

export function registerItemOnGamemasterRegistry(testbed: SimulatorTestbed, opts: {
    tokenId: bigint;
    itemType: bigint;
    stackLimit?: bigint;
    minLevel?: bigint;
    effectCount?: bigint;
}) {
    const stackLimit = opts.stackLimit ?? 0n;
    const minLevel = opts.minLevel ?? 0n;
    const packed1 = opts.itemType | (stackLimit << 8n) | (minLevel << 16n);
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.GamemasterRegistryAddress,
        amount: 1_0000_0000n,
        messageArr: [Context.GamemasterMethods.RegisterItem, opts.tokenId, packed1, opts.effectCount ?? 0n],
    }], Context.GamemasterRegistryAddress);
}

export function registerEffectOnGamemasterRegistry(testbed: SimulatorTestbed, opts: {
    logicalId: bigint;
    target: bigint;
    mode: bigint;
    bonusAbs?: bigint;
    bonusRel?: bigint;
    duration?: bigint;
}) {
    const bonusAbs = opts.bonusAbs ?? 0n;
    const bonusRel = opts.bonusRel ?? 0n;
    const duration = opts.duration ?? 0n;
    const packed1 = opts.target | (opts.mode << 8n);
    const packed2 = bonusAbs | (bonusRel << 16n) | (duration << 32n);
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.GamemasterRegistryAddress,
        amount: 1_0000_0000n,
        messageArr: [Context.GamemasterMethods.RegisterEffect, effectId(opts.logicalId), packed1, packed2],
    }], Context.GamemasterRegistryAddress);
}

export function setItemEffectOnGamemasterRegistry(testbed: SimulatorTestbed, opts: {
    tokenId: bigint;
    slot: bigint;
    logicalEffectId: bigint;
}) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.GamemasterRegistryAddress,
        amount: 1_0000_0000n,
        messageArr: [Context.GamemasterMethods.SetItemEffect, opts.tokenId, opts.slot, effectId(opts.logicalEffectId)],
    }], Context.GamemasterRegistryAddress);
}

export function getEquipBonusAbs(testbed: SimulatorTestbed, target: bigint): bigint {
    return testbed.getContractMapValue(Context.Maps.EquipBonusAbs, target, Context.CharacterAddress);
}

export function getEquipBonusRel(testbed: SimulatorTestbed, target: bigint): bigint {
    return testbed.getContractMapValue(Context.Maps.EquipBonusRel, target, Context.CharacterAddress);
}

export function getStatusEffectExpiry(testbed: SimulatorTestbed, target: bigint): bigint {
    return testbed.getContractMapValue(Context.Maps.StatusEffects, target, Context.CharacterAddress);
}

// Total errors ever recorded (the rolling log's head/count).
export function getErrorCount(testbed: SimulatorTestbed, address = Context.CharacterAddress): bigint {
    return testbed.getContractMapValue(Context.Maps.ErrorMeta, 0n, address) ?? 0n;
}

// The most recently logged error, or undefined if the log is empty.
export function getLastError(testbed: SimulatorTestbed, address = Context.CharacterAddress):
    { code: bigint; txid: bigint; count: bigint } | undefined {
    const count = getErrorCount(testbed, address);
    if (count === 0n) return undefined;
    const slot = (count - 1n) % Context.ErrorLogSize;
    return {
        code: testbed.getContractMapValue(Context.Maps.ErrorCode, slot, address) ?? 0n,
        txid: testbed.getContractMapValue(Context.Maps.ErrorTxid, slot, address) ?? 0n,
        count,
    };
}

// The code stored in a specific ring-buffer slot (for wrap-around assertions).
export function getErrorCodeAtSlot(testbed: SimulatorTestbed, slot: bigint, address = Context.CharacterAddress): bigint {
    return testbed.getContractMapValue(Context.Maps.ErrorCode, slot, address) ?? 0n;
}

// The "ERROR Code: <code>" text message the character pushed to the owner for a
// given error code, or undefined if none was sent.
export function errorMessageTextFor(code: bigint): string {
    return `ERROR Code: ${code}`;
}

export function findErrorMessageToOwner(testbed: SimulatorTestbed, code: bigint) {
    const expected = errorMessageTextFor(code);
    return (testbed.getTransactions() as { sender: bigint; recipient: bigint; messageText?: string }[])
        .find(tx => tx.sender === Context.CharacterAddress
            && tx.recipient === Context.OwnerAccount
            && tx.messageText === expected);
}

// opts.signa is what reroll()'s getAmount() will see — the testbed
// automatically deducts the character's own activationAmount from the raw tx
// amount before the contract can read it, so that headroom is added here.
export function sendReroll(testbed: SimulatorTestbed, opts: {
    signa: bigint;
    sender?: bigint;
    characterAddress?: bigint;
}) {
    const characterAddress = opts.characterAddress ?? Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: opts.signa + Context.ActivationFee,
        messageArr: [Context.Methods.Reroll, 0n, 0n, 0n],
    }], characterAddress);
}

export function sendSeppuku(testbed: SimulatorTestbed, opts: {
    sender?: bigint;
    characterAddress?: bigint;
} = {}) {
    const characterAddress = opts.characterAddress ?? Context.CharacterAddress;
    const response = testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.Seppuku, 0n, 0n, 0n],
    }], characterAddress);

    // Same registry-activation nudge as deployCharacterOnRegistry — a no-op
    // (harmless) if no registry is deployed in this scenario at all.
    testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: Context.CharRegistryAddress,
        amount: 1_0000_0000n,
    }], Context.CharRegistryAddress);

    return response;
}

// Reads the character-account-registry's map — must be deployed at
// Context.CharRegistryAddress (see deployCharacterWithCharRegistry).
export function getCharRegistryValue(testbed: SimulatorTestbed, k1: bigint, k2: bigint): bigint {
    return testbed.getContractMapValue(k1, k2, Context.CharRegistryAddress);
}

// Opens a migration window by setting the gamemaster registry's
// G_NEXT_CHARACTER_HASH — non-zero enables the Character's MIGRATE. The exact
// value is irrelevant to migrate() (it liquidates to the owner and does not
// validate a target), so any non-zero hash enables it.
export function setNextCharacterHashOnGamemasterRegistry(testbed: SimulatorTestbed, hash: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.GamemasterRegistryAddress,
        amount: 1_0000_0000n,
        messageArr: [Context.GamemasterMethods.SetNextCharacterHash, hash, 0n, 0n],
    }], Context.GamemasterRegistryAddress);
}

export function sendMigrate(testbed: SimulatorTestbed, opts: {
    sender?: bigint;
    characterAddress?: bigint;
} = {}) {
    const characterAddress = opts.characterAddress ?? Context.CharacterAddress;
    const response = testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.Migrate, 0n, 0n, 0n],
    }], characterAddress);

    // Nudge the char-account registry to consume the queued unregister message.
    // Only meaningful when a char registry is actually deployed in this scenario
    // — otherwise the target address isn't a contract and the send throws.
    try {
        testbed.sendTransactionAndGetResponse([{
            sender: opts.sender ?? Context.OwnerAccount,
            recipient: Context.CharRegistryAddress,
            amount: 1_0000_0000n,
        }], Context.CharRegistryAddress);
    } catch { /* no char registry in this scenario */ }

    return response;
}

export function setConstructHashOnGamemasterRegistry(testbed: SimulatorTestbed, hash: bigint) {
    // gamemaster-registry.contract.smart.c: M_SET_CONSTRUCT_HASH = 1, writes to
    // (REGISTRY_BASE + 1, 0) — the key character.contract.smart.c reads via
    // GAMEMASTER_MAP_KEY1_CONSTRUCT_HASH.
    // sendTransactionAndGetResponse always overwrites `recipient` with whatever
    // contract `address` resolves to (default: last-loaded/active contract), so
    // the target must be passed explicitly here — otherwise this tx lands on
    // the character contract instead (message code 1 also collides with
    // ALLOCATE_SKILLPOINT there).
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount, // gamemaster == the registry's creator (555n)
        recipient: Context.GamemasterRegistryAddress,
        amount: 1_0000_0000n,
        messageArr: [1n, hash, 0n, 0n],
    }], Context.GamemasterRegistryAddress);
}
