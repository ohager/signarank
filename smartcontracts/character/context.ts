import { join } from 'path';

// Mirrors #defines in character.contract.smart.c as it exists today.
// Several fields referenced in the original design plan (leveling, migrate,
// item registry, status effects) are NOT implemented yet — see the contract
// source itself for the current feature set. Death/revival IS implemented.
export const Context = {
    ContractPath: join(__dirname + '/character.contract.smart.c'),
    ConstructContractPath: join(__dirname, '..', 'construct', 'construct.contract.smart.c'),
    GamemasterRegistryPath: join(__dirname, '..', 'gamemaster-registry', 'gamemaster-registry.contract.smart.c'),
    CharRegistryPath: join(__dirname, '..', 'character-account-registry', 'character-account-registry.contract.smart.c'),

    // SimulatorTestbed default creator is 555n unless overridden — matches getCreator().
    OwnerAccount: 555n,
    CharacterAddress: 999n,
    RevivalTokenId: 2000n,

    // Hardcoded in the contract as GAMEMASTER_REGISTRY — NOT a TESTBED-injectable
    // parameter. To exercise senderIsConstruct()/deductHitpoints gating, the
    // gamemaster-registry contract must be deployed at exactly this address.
    GamemasterRegistryAddress: 122344543654n,

    // Hardcoded in the contract as CHAR_REGISTRY — NOT a TESTBED-injectable
    // parameter. init() sends a registration message here unconditionally; to
    // observe it, the character-account-registry contract must be deployed at
    // exactly this address.
    CharRegistryAddress: 122344543655n,

    ActivationFee: 2_0000_0000n, // must match #program activationAmount 200000000
    RerollMinAmount: 100_0000_0000n, // must match #define REROLL_MIN_AMOUNT
    MaxRerolls: 5n,

    Methods: {
        AllocateSkillpoint: 1n,
        Attack: 2n,
        Reroll: 3n,
        TransferItem: 4n,
        UseItem: 5n,   // defined in the contract but NOT wired into the dispatch switch — always a no-op
        Revive: 6n,
        Seppuku: 66n,
        Refund: 99n,
    },

    // Method codes as the character-account-registry contract defines them —
    // must mirror CHAR_REGISTRY_M_* in character.contract.smart.c.
    CharRegistryMethods: {
        RegisterCharacter: 2n,
        UnregisterCharacter: 3n,
    },

    ConstructMethods: {
        DeductHitpoints: 13n,
    },

    // Contract memory variables — read via getContractMemoryValue(name)
    Vars: {
        CurrentHitpoints: 'currentHitpoints',
        MaxHitpoints: 'maxHitpoints',
        IsDead: 'isDead',
        DeathPenaltyApplied: 'deathPenaltyApplied',
        SkillPoints: 'skillPoints',
        UsedInventorySlots: 'usedInventorySlots',
        MaxInventorySlots: 'maxInventorySlots',
        Committed: 'committed',
        RerollCount: 'rerollCount',
    },

    // KKV map keys — attribute values live at (MAP_KEY1_ATTRIBUTES, attrIndex)
    Maps: {
        Attributes: 1n,
    },

    // 1-indexed — matches MAP_KEY2_ATTRIBUTES_* in the contract (NOT 0-indexed)
    Attrs: {
        Strength: 1n,
        Stamina: 2n,
        Dexterity: 3n,
        Luck: 4n,
        Willpower: 5n,
    },

    // Gamemaster registry keys as the CHARACTER CONTRACT reads them.
    // ConstructHash mirrors the real gamemaster-registry's G_CONSTRUCT_HASH
    // (REGISTRY_BASE + 1) — see character.contract.smart.c.
    GamemasterKeysAsReadByCharacter: {
        Items: 1n,
        ConstructHash: 0x7FFFFFFFFFF00000n + 1n,
        CharacterHash: 3n,
    },
} as const;
