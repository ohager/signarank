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

export function deployCharacter(opts: { creator?: bigint; address?: bigint; revivalTokenId?: bigint } = {}) {
    const testbed = new Testbed(
        BootstrapScenario.map(tx => ({ ...tx, recipient: opts.address ?? Context.CharacterAddress })),
    ).loadContract(Context.ContractPath, {
        creator: opts.creator ?? Context.OwnerAccount,
        contractId: opts.address ?? Context.CharacterAddress,
        // Passing ANY initializer activates the whole #ifdef TESTBED block in
        // the contract, so every TESTBED_-referenced var must be supplied —
        // constructorAccount is otherwise unused but must still be provided.
        initializers: { constructorAccount: 0n, revivalTokenId: opts.revivalTokenId ?? Context.RevivalTokenId },
    });
    testbed.runScenario();
    return testbed;
}

// Codehash is a pure function of source (not runtime state), so it can be
// learned from a throwaway, never-run load.
function characterCodeHash(revivalTokenId: bigint): bigint {
    return new Testbed().loadContract(Context.ContractPath, {
        initializers: { constructorAccount: 0n, revivalTokenId },
    }).getContract().codeHashId;
}

// Deploys a real character-account-registry at the hardcoded CHAR_REGISTRY
// address and configures its trusted character hash — required BEFORE any
// character is deployed, since init()'s registration message is one-shot and
// silently lost forever if the trust hash isn't already configured when it
// fires. Returns the bare testbed; use deployCharacterOnRegistry to add
// characters to it.
export function deployCharRegistry(opts: { revivalTokenId?: bigint } = {}) {
    const revivalTokenId = opts.revivalTokenId ?? Context.RevivalTokenId;
    const codeHashId = characterCodeHash(revivalTokenId);

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
    revivalTokenId?: bigint;
} = {}) {
    const characterAddress = opts.address ?? Context.CharacterAddress;
    testbed.loadContract(Context.ContractPath, {
        creator: opts.creator ?? Context.OwnerAccount,
        contractId: characterAddress,
        initializers: { constructorAccount: 0n, revivalTokenId: opts.revivalTokenId ?? Context.RevivalTokenId },
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
    revivalTokenId?: bigint;
} = {}) {
    const testbed = deployCharRegistry({ revivalTokenId: opts.revivalTokenId });
    deployCharacterOnRegistry(testbed, opts);
    return testbed;
}

// Deploys the character plus a real gamemaster-registry at the hardcoded
// GAMEMASTER_REGISTRY address, and a distinct "construct" stand-in contract
// (any different bytecode works — only its codehash matters) so tests can
// exercise the real codehash-comparison path in senderIsConstruct().
export function deployCharacterWithGamemasterRegistry(opts: {
    creator?: bigint;
    address?: bigint;
    constructStandInAddress?: bigint;
    revivalTokenId?: bigint;
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
        // constructorAccount is otherwise unused but must still be provided.
        initializers: { constructorAccount: 0n, revivalTokenId: opts.revivalTokenId ?? Context.RevivalTokenId },
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
    revivalTokenId?: bigint;
} = {}) {
    const result = deployCharacterWithGamemasterRegistry(opts);
    setConstructHashOnGamemasterRegistry(result.testbed, result.constructStandIn!.codeHashId);
    return result;
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
}) {
    const characterAddress = opts.characterAddress ?? Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: opts.signa * 1_0000_0000n + Context.ActivationFee,
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

export function sendRefund(testbed: SimulatorTestbed, opts: { sender?: bigint; assetId?: bigint } = {}) {
    const characterAddress = Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.Refund, opts.assetId ?? 0n, 0n, 0n],
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
// message content. Use together with sendRevive() to simulate the token
// arriving in an earlier, unrelated transaction.
export function fundCharacterWithToken(testbed: SimulatorTestbed, opts: {
    sender?: bigint;
    tokenId?: bigint;
    quantity?: bigint;
} = {}) {
    const characterAddress = Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        tokens: [{ asset: opts.tokenId ?? Context.RevivalTokenId, quantity: opts.quantity ?? 1n }],
        messageArr: [0n, 0n, 0n, 0n],
    }], characterAddress);
}

// Calls the explicit REVIVE method. Optionally attaches the revival token in
// the SAME transaction (opts.attachToken) to exercise the same-tx balance
// visibility path, rather than relying on a token funded earlier.
export function sendRevive(testbed: SimulatorTestbed, opts: {
    sender?: bigint;
    attachToken?: { tokenId?: bigint; quantity?: bigint };
} = {}) {
    const characterAddress = Context.CharacterAddress;
    return testbed.sendTransactionAndGetResponse([{
        sender: opts.sender ?? Context.OwnerAccount,
        recipient: characterAddress,
        amount: Context.ActivationFee,
        tokens: opts.attachToken
            ? [{ asset: opts.attachToken.tokenId ?? Context.RevivalTokenId, quantity: opts.attachToken.quantity ?? 1n }]
            : [],
        messageArr: [Context.Methods.Revive, 0n, 0n, 0n],
    }], characterAddress);
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
