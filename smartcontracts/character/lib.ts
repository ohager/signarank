import type { SimulatorTestbed, TransactionObj } from 'signum-smartc-testbed';
import { SimulatorTestbed as Testbed } from 'signum-smartc-testbed';
import { join } from 'path';
import { Context } from './context';

const CONSTRUCT_STANDIN_PATH = join(__dirname, '..', 'character-account-registry', 'character-account-registry.contract.smart.c');

// The contract has no #ifdef TESTBED block requiring any parameter, so a
// plain funding tx is enough to trigger the (once-only) init() and deploy.
export const BootstrapScenario: TransactionObj[] = [
    {
        blockheight: 1,
        amount: 200_0000_0000n,
        sender: Context.OwnerAccount,
        recipient: Context.CharacterAddress,
    },
];

export function deployCharacter(opts: { creator?: bigint; address?: bigint; xpTokenId?: bigint } = {}) {
    const testbed = new Testbed(
        BootstrapScenario.map(tx => ({ ...tx, recipient: opts.address ?? Context.CharacterAddress })),
    ).loadContract(Context.ContractPath, {
        creator: opts.creator ?? Context.OwnerAccount,
        contractId: opts.address ?? Context.CharacterAddress,
        // Passing ANY initializer activates the whole #ifdef TESTBED block in
        // the contract, so every TESTBED_-referenced var must be supplied —
        // constructorAccount is otherwise unused but must still be provided.
        initializers: {
            constructorAccount: 0n,
            xpTokenId: opts.xpTokenId ?? Context.XpTokenId,
        },
    });
    testbed.runScenario();
    return testbed;
}

// Codehash is a pure function of source (not runtime state), so it can be
// learned from a throwaway, never-run load.
function characterCodeHash(xpTokenId: bigint): bigint {
    return new Testbed().loadContract(Context.ContractPath, {
        initializers: { constructorAccount: 0n, xpTokenId },
    }).getContract().codeHashId;
}

// Deploys a real character-account-registry at the hardcoded CHAR_REGISTRY
// address and configures its trusted character hash — required BEFORE any
// character is deployed, since init()'s registration message is one-shot and
// silently lost forever if the trust hash isn't already configured when it
// fires. Returns the bare testbed; use deployCharacterOnRegistry to add
// characters to it.
export function deployCharRegistry(opts: { xpTokenId?: bigint } = {}) {
    const xpTokenId = opts.xpTokenId ?? Context.XpTokenId;
    const codeHashId = characterCodeHash(xpTokenId);

    const testbed = new Testbed().loadContract(Context.CharRegistryPath, { contractId: Context.CharRegistryAddress });
    testbed.runScenario();

    testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount, // registry's creator defaults to 555n
        recipient: Context.CharRegistryAddress,
        amount: 1_0000_0000n,
        messageArr: [1n, codeHashId, 0n, 0n], // M_SET_CHARACTER_HASH
    }], Context.CharRegistryAddress);

    return testbed;
}

// Deploys+funds a character on a testbed whose registry trust hash is already
// configured (see deployCharRegistry) — init()'s registration message will
// carry its own activation fee to the registry and be picked up for real.
export function deployCharacterOnRegistry(testbed: SimulatorTestbed, opts: {
    creator?: bigint;
    address?: bigint;
    xpTokenId?: bigint;
} = {}) {
    const characterAddress = opts.address ?? Context.CharacterAddress;
    testbed.loadContract(Context.ContractPath, {
        creator: opts.creator ?? Context.OwnerAccount,
        contractId: characterAddress,
        initializers: {
            constructorAccount: 0n,
            xpTokenId: opts.xpTokenId ?? Context.XpTokenId,
        },
    });
    // sendTransactionAndGetResponse auto-resolves blockheight, unlike a raw
    // runScenario() call, which is required here since the chain is already
    // several blocks in by the time a second/third character is deployed.
    testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: characterAddress,
        amount: 200_0000_0000n,
    }], characterAddress);

    // The simulator only re-activates a contract on a block where it either
    // just received a qualifying tx or was already scheduled to wake — the
    // registry's own consumption of the queued registration message (sent by
    // the character's init(), one block prior) needs one more nudge here.
    testbed.sendTransactionAndGetResponse([{
        sender: Context.OwnerAccount,
        recipient: Context.CharRegistryAddress,
        amount: 1_0000_0000n,
    }], Context.CharRegistryAddress);
    return testbed;
}

// Convenience wrapper for the common single-character case.
export function deployCharacterWithCharRegistry(opts: {
    creator?: bigint;
    address?: bigint;
    xpTokenId?: bigint;
} = {}) {
    const testbed = deployCharRegistry({ xpTokenId: opts.xpTokenId });
    deployCharacterOnRegistry(testbed, opts);
    return testbed;
}

// Deploys character-account-registry + gamemaster-registry + a construct
// stand-in + the character, with BOTH registries' trust fully configured —
// needed for scenarios that require a real death (via a trusted construct's
// DEDUCT_HITPOINTS) AND registry-observable effects (e.g. seppuku, which now
// requires isDead == TRUE) in the same test.
export function deployCharacterWithRegistries(opts: {
    creator?: bigint;
    address?: bigint;
    constructStandInAddress?: bigint;
    xpTokenId?: bigint;
} = {}) {
    const constructAddress = opts.constructStandInAddress ?? 888n;

    const testbed = deployCharRegistry({ xpTokenId: opts.xpTokenId });
    testbed
        .loadContract(Context.GamemasterRegistryPath, { contractId: Context.GamemasterRegistryAddress })
        .loadContract(CONSTRUCT_STANDIN_PATH, { contractId: constructAddress });
    const constructStandIn = testbed.getContract(constructAddress);

    deployCharacterOnRegistry(testbed, opts);
    setConstructHashOnGamemasterRegistry(testbed, constructStandIn.codeHashId);

    return { testbed, constructStandIn, constructAddress };
}

// Deploys the character plus a real gamemaster-registry at the hardcoded
// GAMEMASTER_REGISTRY address, and a distinct "construct" stand-in contract
// (any different bytecode works — only its codehash matters) so tests can
// exercise the real codehash-comparison path in senderIsConstruct().
export function deployCharacterWithGamemasterRegistry(opts: {
    creator?: bigint;
    address?: bigint;
    constructStandInAddress?: bigint;
    xpTokenId?: bigint;
    // Where a dead character's randomly-dropped item is returned. Defaults to 0
    // (burn); set to an observable account to assert the drop lands there.
    constructorAccount?: bigint;
} = {}) {
    const characterAddress = opts.address ?? Context.CharacterAddress;
    const constructAddress = opts.constructStandInAddress ?? 888n;

    const testbed = new Testbed(
        BootstrapScenario.map(tx => ({ ...tx, recipient: characterAddress })),
    )
        .loadContract(Context.GamemasterRegistryPath, { contractId: Context.GamemasterRegistryAddress })
        // character-account-registry.contract.smart.c is used purely as a distinct,
        // zero-initializer bytecode to stand in for "the construct" — only its
        // codehash matters here, not its actual behavior.
        .loadContract(CONSTRUCT_STANDIN_PATH, { contractId: constructAddress })
        .loadContract(Context.ContractPath, {
            creator: opts.creator ?? Context.OwnerAccount,
            contractId: characterAddress,
            // Passing ANY initializer activates the whole #ifdef TESTBED block in
        // the contract, so every TESTBED_-referenced var must be supplied —
        // constructorAccount defaults to 0 (burn) unless the test observes drops.
        initializers: {
            constructorAccount: opts.constructorAccount ?? 0n,
            xpTokenId: opts.xpTokenId ?? Context.XpTokenId,
        },
        });

    const constructStandIn = testbed.getContract(constructAddress);
    testbed.runScenario();
    return { testbed, constructStandIn, constructAddress };
}

// Convenience wrapper: deploys character + gamemaster-registry + construct
// stand-in, AND registers the stand-in's codehash as the trusted construct
// hash via the real M_SET_CONSTRUCT_HASH flow — the fully "correctly
// configured" scenario senderIsConstruct() is meant to authorize.
export function deployCharacterWithTrustedConstruct(opts: {
    creator?: bigint;
    address?: bigint;
    constructStandInAddress?: bigint;
    xpTokenId?: bigint;
    constructorAccount?: bigint;
} = {}) {
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

export function getAttr(testbed: SimulatorTestbed, attrKey2: bigint): bigint {
    return testbed.getContractMapValue(Context.Maps.Attributes, attrKey2);
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
