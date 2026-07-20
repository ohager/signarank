import {SimulatorTestbed} from "signum-smartc-testbed";
import {join} from "path";
import {Context} from "./context";
import {SmartC} from "smartc-signum-compiler";

// A test-only character stand-in whose codehash is registered as the trusted
// G_CHARACTER_HASH (so senderIsCharacter() fires) and which can publish exact
// public stats into its map for deterministic cross-contract read tests.
const CharacterStandInPath = join(__dirname, 'character.mock.contract.smart.c');

// Codehash is a pure function of source; loading (without activation) is enough.
export function characterStandInCodeHash(): bigint {
    return new SimulatorTestbed().loadContract(CharacterStandInPath).getContract().codeHashId;
}

export function compileToBytecode(code: string) {
    const compiler = new SmartC({
        language: "C",
        sourceCode: code,
    });
    compiler.compile();
    return compiler.getMachineCode();
}


export function getCurrentHitpoints(testbed: SimulatorTestbed) {
    // Target the construct explicitly — other contracts (e.g. a character
    // stand-in) may be loaded, so the default contract is ambiguous.
    const hpTokenId = testbed.getContractMemoryValue('hpTokenId', Context.ThisContract);
    const hpToken = testbed.getContract(Context.ThisContract).tokens.find(t => t.asset === hpTokenId);
    return hpToken?.quantity
}

type AttackParams = {
    testbed: SimulatorTestbed,
    signa: bigint,
    tokens?: Array<{ asset: bigint, quantity: bigint }>,
    sender?: bigint
}


export function attack({testbed, sender = Context.SenderAccount1, signa, tokens = []}: AttackParams) {

    if (tokens.length > 4) {
        throw new Error("Max 4 tokens allowed")
    }

    return testbed.sendTransactionAndGetResponse([{
        sender,
        recipient: Context.ThisContract,
        amount: (signa * 1_0000_0000n) + Context.ActivationFee,
        tokens
    }], Context.ThisContract) // activate the construct explicitly — a character stand-in may also be loaded
}

// Performs an attack and reports whether the (EOA) attacker received a COUNTER
// message this activation — the reliable "counter fired" signal. The testbed
// concatenates all short messages to one recipient per activation, so a counter
// can be preceded by FIRST BLOOD / BREACH text; match a substring, not a prefix.
export function attackAndDidCounter(params: AttackParams): boolean {
    const sender = params.sender ?? Context.SenderAccount1;
    const before = params.testbed.getTransactions().length;
    attack(params);
    return params.testbed.getTransactions().slice(before).some(
        (tx) => tx.recipient === sender && (tx.messageText ?? "").includes("COUNTER"),
    );
}

// Counts counters fired over `rounds` attacks from the same EOA (advancing past
// cooldown between hits). Use with a survivable construct (breachLimit low +
// xpSupply ≥ maxHp) so all rounds land.
export function countCounters(params: AttackParams & { rounds: number; cooldownBlocks?: bigint }): number {
    let fired = 0;
    for (let i = 0; i < params.rounds; i++) {
        if (attackAndDidCounter(params)) fired++;
        timeLapse({ testbed: params.testbed, blocks: params.cooldownBlocks ?? 20n });
    }
    return fired;
}

type TimelapseType = {
    testbed: SimulatorTestbed,
    blocks: bigint
}

export function timeLapse({testbed, blocks}: TimelapseType) {
    for (let i = 0; i < blocks; i++) {
        testbed.blockchain.forgeBlock()
    }
}


// xpTokenId is no longer an initializer — the construct sources it from the
// gamemaster registry (G_XP_TOKEN). Everything else stays deployer-configured.
export const DefaultRequiredInitializers = {
    name: "CT000001",
    maxHp: 50_000n,
    breachLimit: 0n, // keep default
    coolDownInBlocks: 0n, // keep default
    firstBloodBonus: 0n,
    finalBlowBonus: 0n,
    isActive: 0n,
    rewardNftId: 0n
}

// Sends a creator-gated tx to the seeded gamemaster registry.
function asGamemaster(testbed: SimulatorTestbed, messageArr: bigint[]) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount, // registry creator defaults to 555n
        recipient: Context.GamemasterRegistryAddress,
        amount: 1_0000_0000n,
        messageArr,
    }], Context.GamemasterRegistryAddress);
}

export function setCharacterHashOnRegistry(testbed: SimulatorTestbed, hash: bigint) {
    return asGamemaster(testbed, [Context.GamemasterMethods.SetCharacterHash, hash, 0n, 0n]);
}

export function setNextCharacterHashOnRegistry(testbed: SimulatorTestbed, hash: bigint) {
    return asGamemaster(testbed, [Context.GamemasterMethods.SetNextCharacterHash, hash, 0n, 0n]);
}

// Deploys a seeded gamemaster registry (G_XP_TOKEN, optionally the trusted
// character hashes) BEFORE the construct, then loads + bootstraps the construct
// (charge + XP-token supply, then the minting activation) — mirroring the old
// BootstrapScenario but with the registry the construct's init() now reads.
export function deployConstruct(
    initializerOverrides: Record<string, unknown> = {},
    opts: {
        characterHash?: bigint;
        nextCharacterHash?: bigint;
        xpSupply?: bigint;
        // Creator/config messages to apply right after deploy (replaces the old
        // `new SimulatorTestbed([...BootstrapScenario, tx])` idiom). `blockheight`
        // on these is ignored — they're sent post-bootstrap via the testbed.
        extraTxs?: Array<{ sender: bigint; recipient?: bigint; amount: bigint; messageArr?: bigint[]; tokens?: Array<{ asset: bigint; quantity: bigint }> }>;
    } = {},
) {
    const testbed = new SimulatorTestbed([{
        blockheight: 1,
        amount: 100_0000_0000n,
        sender: Context.CreatorAccount,
        recipient: Context.GamemasterRegistryAddress,
    }]).loadContract(Context.GamemasterRegistryPath, { contractId: Context.GamemasterRegistryAddress });
    testbed.runScenario();

    asGamemaster(testbed, [Context.GamemasterMethods.SetXpToken, Context.XPTokenId, 0n, 0n]);
    if (opts.characterHash !== undefined) setCharacterHashOnRegistry(testbed, opts.characterHash);
    if (opts.nextCharacterHash !== undefined) setNextCharacterHashOnRegistry(testbed, opts.nextCharacterHash);

    testbed.loadContract(Context.ContractPath, {
        contractId: Context.ThisContract,
        initializers: { ...DefaultRequiredInitializers, ...initializerOverrides },
    });
    // charge + XP-token supply → triggers init() (reads G_XP_TOKEN, issues hpToken)
    testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: 200_0000_0000n,
        tokens: [{ asset: Context.XPTokenId, quantity: opts.xpSupply ?? 50_000n }],
    }], Context.ThisContract);
    // second activation → main() mints the hpToken HP pool
    testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: 2_0000_0000n,
    }], Context.ThisContract);

    // Post-deploy config messages (e.g. creator SET calls the old scenario appended).
    for (const tx of opts.extraTxs ?? []) {
        testbed.sendTransactionAndGetResponse([{
            sender: tx.sender,
            recipient: tx.recipient ?? Context.ThisContract,
            amount: tx.amount,
            messageArr: tx.messageArr,
            tokens: tx.tokens,
        }], Context.ThisContract);
    }

    return testbed;
}

// The account a character-attacker stand-in is deployed at (attacks are sent
// with `sender: characterAddress` so getCodeHashOf resolves to the character
// codehash seeded as G_CHARACTER_HASH).
export const CharacterAttackerAddress = 777n;

// Deploys a construct whose gamemaster registry already trusts the character
// stand-in's codehash (G_CHARACTER_HASH), and loads that stand-in at
// CharacterAttackerAddress so tests can attack "as a character".
export function deployConstructWithCharacter(
    initializerOverrides: Record<string, unknown> = {},
    opts: {
        nextCharacterHash?: bigint;
        xpSupply?: bigint;
        extraTxs?: Array<{ sender: bigint; recipient?: bigint; amount: bigint; messageArr?: bigint[]; tokens?: Array<{ asset: bigint; quantity: bigint }> }>;
    } = {},
) {
    const characterCodeHash = characterStandInCodeHash();
    const testbed = deployConstruct(initializerOverrides, { ...opts, characterHash: characterCodeHash });
    // Load the stand-in with a known creator so getCreatorOf(character) — the
    // reward-routing "owner" — is a controllable EOA in tests.
    testbed.loadContract(CharacterStandInPath, { contractId: CharacterAttackerAddress, creator: Context.CharacterOwnerAccount });
    return { testbed, characterAddress: CharacterAttackerAddress, characterOwner: Context.CharacterOwnerAccount, characterCodeHash };
}

// Publishes a single (key1, key2, value) entry into the character stand-in's
// public map — the construct reads these via getExtMapValue. Use with the
// character-map key constants (Context.CharacterMap.*).
export function setCharacterStat(testbed: SimulatorTestbed, key1: bigint, key2: bigint, value: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: CharacterAttackerAddress,
        amount: 1_0000_0000n, // self-funds the mock's activation
        messageArr: [key1, key2, value, 0n],
    }], CharacterAttackerAddress);
}

// Convenience: seed the character's PUBLISHED combat profile in one call — the
// same public keys the real character writes via publishCombatProfile().
export function setCharacterStats(
    testbed: SimulatorTestbed,
    stats: { strength?: bigint; level?: bigint; luck?: bigint; attackAbs?: bigint; attackRel?: bigint; attackEffect?: bigint },
) {
    if (stats.strength !== undefined) setCharacterStat(testbed, Context.CharacterMap.Combat, Context.CharacterMap.Strength, stats.strength);
    if (stats.luck !== undefined) setCharacterStat(testbed, Context.CharacterMap.Combat, Context.CharacterMap.Luck, stats.luck);
    if (stats.attackAbs !== undefined) setCharacterStat(testbed, Context.CharacterMap.Combat, Context.CharacterMap.AttackAbs, stats.attackAbs);
    if (stats.attackRel !== undefined) setCharacterStat(testbed, Context.CharacterMap.Combat, Context.CharacterMap.AttackRel, stats.attackRel);
    if (stats.attackEffect !== undefined) setCharacterStat(testbed, Context.CharacterMap.Combat, Context.CharacterMap.AttackEffect, stats.attackEffect);
    if (stats.level !== undefined) setCharacterStat(testbed, Context.CharacterMap.Progression, Context.CharacterMap.Level, stats.level);
}

// Configures a drop-table slot (creator-gated SETDROPTOKEN). slot + threshold are
// packed into one message arg (msg holds only 3 args): slot | (threshold << 8).
// tokenId 0 clears the slot.
export function setDropToken(testbed: SimulatorTestbed, slot: bigint, tokenId: bigint, threshold: bigint, quantity: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.SetDropToken, slot | (threshold << 8n), tokenId, quantity],
    }], Context.ThisContract);
}

// Sets the drop-roll attack-type modifiers (SETDROPMODIFIERS) — normal/firstBlood/finalBlow.
export function setDropModifiers(testbed: SimulatorTestbed, normal: bigint, firstBlood: bigint, finalBlow: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.SetDropModifiers, normal, firstBlood, finalBlow],
    }], Context.ThisContract);
}

// Sets the luck factor (SETLUCKFACTOR) — effectiveRoll -= luck × factor.
export function setLuckFactor(testbed: SimulatorTestbed, factor: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.SetLuckFactor, factor, 0n, 0n],
    }], Context.ThisContract);
}

// Funds the construct with a token supply (e.g. drop loot) — a plain creator
// token transfer with no message; the tokens accumulate in the construct.
export function fundConstructWithToken(testbed: SimulatorTestbed, tokenId: bigint, quantity: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        tokens: [{asset: tokenId, quantity}],
    }], Context.ThisContract);
}

// Configures the counter/debuff (creator-gated SETDEBUFF): chance, damageReduction, maxStack.
export function setDebuff(testbed: SimulatorTestbed, chance: bigint, damageReduction: bigint, maxStack: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.SetDebuff, chance, damageReduction, maxStack],
    }], Context.ThisContract);
}

// Sets the base counter damage for character targets (creator-gated SETCOUNTERDAMAGE).
export function setCounterDamage(testbed: SimulatorTestbed, base: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.SetCounterDamage, base, 0n, 0n],
    }], Context.ThisContract);
}

// Sets the timed debuff the counter bundles into its COMBAT hit (SETCOUNTEREFFECT).
export function setCounterEffect(testbed: SimulatorTestbed, effectId: bigint, duration: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.SetCounterEffect, effectId, duration, 0n],
    }], Context.ThisContract);
}

// Sets the construct's per-effect affinity (creator-gated SETEFFECTAFFINITY):
// modifier% applied to a character attack whose element == effectId. >100 =
// weakness, <100 = resistance, unset/0 = neutral (100%).
export function setEffectAffinity(testbed: SimulatorTestbed, effectId: bigint, modifier: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.SetEffectAffinity, effectId, modifier, 0n],
    }], Context.ThisContract);
}

// Sets the construct's stat-damage factors (creator-gated SETCHARACTERDAMAGE).
export function setCharacterDamage(testbed: SimulatorTestbed, strFactor: bigint, lvlFactor: bigint) {
    return testbed.sendTransactionAndGetResponse([{
        sender: Context.CreatorAccount,
        recipient: Context.ThisContract,
        amount: Context.ActivationFee,
        messageArr: [Context.Methods.SetCharacterDamage, strFactor, lvlFactor, 0n],
    }], Context.ThisContract);
}
