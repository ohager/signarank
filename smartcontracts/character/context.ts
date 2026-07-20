import { join } from 'path';

// Mirrors #defines in character.contract.smart.c as it exists today.
// Migrate and status-effect construct-side reads are NOT implemented yet —
// see the contract source itself for the current feature set.
export const Context = {
    ContractPath: join(__dirname + '/character.contract.smart.c'),
    ConstructContractPath: join(__dirname, '..', 'construct', 'construct.contract.smart.c'),
    GamemasterRegistryPath: join(__dirname, '..', 'gamemaster-registry', 'gamemaster-registry.contract.smart.c'),
    CharRegistryPath: join(__dirname, '..', 'character-account-registry', 'character-account-registry.contract.smart.c'),

    // SimulatorTestbed default creator is 555n unless overridden — matches getCreator().
    OwnerAccount: 555n,
    CharacterAddress: 999n,
    XpTokenId: 2001n,

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
    LevelXpBase: 1000n, // must match #define LEVEL_XP_BASE — XP required for level 2
    ErrorLogSize: 50n, // must match #define ERROR_LOG_SIZE

    // Incoming-damage mitigation — must mirror the #defines in the contract.
    // net = dodged ? 0 : max(0, rawDamage - stamina * ArmorPerStamina)
    // dodgeChance% = min(DodgeMaxPct, (dexterity + luck) * DodgePctPerPoint)
    DamageMitigation: {
        ArmorPerStamina: 2n,
        DodgePctPerPoint: 2n,
        DodgeMaxPct: 60n,
    },

    // Rolling error-log codes — must mirror #define ERR_* in the contract.
    Errors: {
        AttackNotPossible: 1n,
        RerollCommitted: 2n,
        RerollMaxReached: 3n,
        RerollInsufficient: 4n,
        TransferToContract: 5n,
        TransferItemNotHeld: 6n,
        UseItemNotHeld: 7n,
        UseItemNotConsumable: 8n,
        DepositAmbiguous: 9n,
        InventoryFull: 10n,
        AllocNoSkillpoints: 11n,
        AllocInvalidAttribute: 12n,
        ItemNotRegistered: 13n,
        ItemLevelTooLow: 14n,
        ItemStackLimit: 15n,
        UseItemNoEffect: 16n,
        EquipMultiUnit: 17n,
        TransferXp: 18n,
        MigrateDisabled: 19n,
        CharacterDead: 66n,
    },

    Methods: {
        AllocateSkillpoint: 1n,
        Attack: 2n,
        Reroll: 3n,
        TransferItem: 4n,
        UseItem: 5n,
        Seppuku: 66n,
        Migrate: 77n,
        Refund: 99n,
    },

    // gamemaster-registry.contract.smart.c's own method codes.
    GamemasterMethods: {
        SetConstructHash: 1n,
        SetCharacterHash: 2n,
        // 3 retired (SetLevelThreshold — leveling is triangular, not registry config)
        SetXpToken: 4n,
        SetConstructorAccount: 5n,
        SetCharRegistry: 6n,
        SetNextCharacterHash: 7n,
        RegisterItem: 10n,
        UnregisterItem: 11n,
        SetItemEffect: 12n,
        RegisterEffect: 20n,
        UnregisterEffect: 21n,
    },

    ItemType: {
        Equipment: 1n,
        Consumable: 2n,
    },

    EffectMode: {
        AggregateAbs: 1n,
        AggregateRel: 2n,
        Heal: 3n,
        Revive: 4n,
        StatusEffect: 5n,
    },

    // Initial Effect Target assignments (gamemaster-registry-design.md).
    EffectTarget: {
        AttackDamage: 0n,
        Hp: 1n,
        Strength: 2n,
        Stamina: 3n,
        Dexterity: 4n,
        Luck: 5n,
        Willpower: 6n,
        InventorySlots: 7n,
        DamageTaken: 8n,
    },

    // Method codes as the character-account-registry contract defines them —
    // must mirror CHAR_REGISTRY_M_* in character.contract.smart.c.
    CharRegistryMethods: {
        RegisterCharacter: 2n,
        UnregisterCharacter: 3n,
    },

    ConstructMethods: {
        DeductHitpoints: 13n,
        // COMBAT(rawDamage, effectId, duration): deduct HP + apply a timed status
        // effect (effectId 0 = pure damage, == DeductHitpoints). Construct-only.
        Combat: 14n,
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
        Level: 'level',
        NextLevelXp: 'nextLevelXp',
        ErrorCount: 'errorCount',
        Migrated: 'migrated',
    },

    // KKV map keys — attribute values live at (MAP_KEY1_ATTRIBUTES, attrIndex)
    Maps: {
        Attributes: 1n,
        // Public progression sheet (cross-contract readable) — republished every
        // activation. key2: 1 = level, 2 = skill points.
        Progression: 3n,
        // Public combat profile (cross-contract readable) — republished every
        // activation for the construct to read. key2: see CombatKeys.
        Combat: 4n,
        // key2 = EffectTarget — see character.contract.smart.c's applyEffect()
        EquipBonusAbs: 10n,
        EquipBonusRel: 11n,
        StatusEffects: 12n,
        // key2 = EffectTarget — source effectId of each active status effect.
        StatusEffectId: 15n,
        // Live combat-state sheet (cross-contract readable). key2: see VitalsKeys.
        Vitals: 16n,
        // Rolling error log — map[ErrorCode][slot], map[ErrorTxid][slot],
        // map[ErrorMeta][0] = total ever. Must mirror MAP_KEY1_ERROR_* .
        ErrorCode: 20n,
        ErrorTxid: 21n,
        ErrorMeta: 22n,
    },

    // key2 sub-ids under Maps.Progression — mirror MAP_KEY2_PROGRESSION_* .
    ProgressionKeys: {
        Level: 1n,
        SkillPoints: 2n,
    },

    // key2 sub-ids under Maps.Combat — mirror MAP_KEY2_COMBAT_* . Effective =
    // base attribute + equipment aggregate. Read by the construct for damage.
    CombatKeys: {
        Strength: 1n,   // effective strength (base + equip)
        Luck: 2n,       // effective luck (base + equip)
        AttackAbs: 3n,  // flat attack bonus from equipment (EQUIP_BONUS_ABS[Attack])
        AttackRel: 4n,  // % attack bonus from equipment (EQUIP_BONUS_REL[Attack])
        AttackEffect: 5n, // primary attack effect id (element) for construct affinity
    },

    // key2 sub-ids under Maps.Vitals — mirror MAP_KEY2_VITALS_* .
    VitalsKeys: {
        CurrentHp: 1n,
        MaxHp: 2n,
        IsDead: 3n,
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

    // gamemaster-registry.contract.smart.c's own key layout — see
    // docs/superpowers/specs/2026-05-06-gamemaster-registry-design.md.
    RegistryBase: 0x7FFFFFFFFFF00000n,
    MinEffectId: 100n, // added to RegistryBase to form the real effectId
    ItemKey: {
        Type: 1n,
        StackLimit: 2n,
        MinLevel: 3n,
        EffectCount: 4n,
        EffectBase: 10n,
    },
    EffectKey: {
        Target: 1n,
        BonusAbs: 2n,
        BonusRel: 3n,
        Mode: 4n,
        Duration: 5n,
    },
} as const;
