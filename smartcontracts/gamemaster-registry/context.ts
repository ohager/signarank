import { join } from 'path';

// Registry namespace lives at the high end of int64.
// Items occupy everything below REGISTRY_BASE (incl. negative longs = large uint64 token IDs).
const REGISTRY_BASE = 0x7FFFFFFFFFF00000n;

export const Context = {
    ContractPath: join(__dirname + '/gamemaster-registry.contract.smart.c'),
    CreatorAccount:    555n,
    GamemasterAccount: 555n,
    ThisContract:      888n,

    RegistryBase: REGISTRY_BASE,

    Methods: {
        SetConstructHash:  1n,
        SetCharacterHash:  2n,
        SetLevelThreshold: 3n,
        RegisterItem:     10n,
        UnregisterItem:   11n,
        SetItemEffect:    12n,
        RegisterEffect:   20n,
        UnregisterEffect: 21n,
    },

    // Global Settings (k1, k2 = sub-id)
    Globals: {
        ConstructHash:  REGISTRY_BASE + 1n,   // (REGISTRY_BASE+1,  0)
        CharacterHash:  REGISTRY_BASE + 2n,   // (REGISTRY_BASE+2,  0)
        LevelThreshold: REGISTRY_BASE + 10n,  // (REGISTRY_BASE+10, level)
        ErrorLog:       REGISTRY_BASE + 99n,  // (REGISTRY_BASE+99, txId) = errorCode
    },

    Errors: {
        TokenIdInvalid:     1n,
        EffectIdInvalid:    2n,
        InvalidItemType:    3n,
        InvalidMode:        4n,
        InvalidSlot:        5n,
        EffectCountInvalid: 6n,
    },

    // Item Definition properties (k1 = tokenId, k2 = property-id)
    ItemKeys: {
        Type:         1n,
        StackLimit:   2n,
        MinLevel:     3n,
        EffectCount:  4n,
        EffectBase:  10n,  // slot i at EffectBase + i
    },

    // Effect Definition properties (k1 = effectId, k2 = property-id)
    EffectKeys: {
        Target:   1n,
        BonusAbs: 2n,
        BonusRel: 3n,
        Mode:     4n,
        Duration: 5n,
    },

    ItemTypes: {
        Equipment:  1n,
        Consumable: 2n,
    },

    Modes: {
        AggregateAbs:  1n,
        AggregateRel:  2n,
        Heal:          3n,
        Revive:        4n,
        StatusEffect:  5n,
    },

    Targets: {
        Attack:      0n,
        HP:          1n,
        Strength:    2n,
        Stamina:     3n,
        Dexterity:   4n,
        Luck:        5n,
        Willpower:   6n,
        InvSlots:    7n,
        DamageTaken: 8n,
    },

    MinEffectId:           REGISTRY_BASE + 100n,
    MaxEffectId:           REGISTRY_BASE + 999_999n,
    MaxEffectSlotsPerItem:                    8n,
} as const;
