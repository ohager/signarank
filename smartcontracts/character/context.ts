import { join } from 'path';

export const Context = {
    ContractPath: join(__dirname + '/character.contract.smart.c'),
    // Simulator default creator is 555n — matches getCreator() in contract
    OwnerAccount: 555n,
    CharacterAddress: 999n,
    CharacterAddressWithRegistry: 1000n,
    ItemRegistryAddress: 999n,
    ConstructContract: 888n,
    XPTokenId: 1000n,
    RevivalTokenId: 2000n,
    ActivationFee: 1_0000_0000n,

    Methods: {
        AllocateSkill:     1n,
        Attack:            2n,
        CollectItems:      3n,
        Migrate:           4n,
        EmergencyWithdraw: 5n,
        SetLevelThreshold: 6n,
        UseItem:           7n,
        CounterAttack:   100n,
        Buff:            102n,
        Debuff:          103n,
    },

    // 0-indexed — maps directly to the attrs[] array in the contract
    Attrs: {
        Strength:  0n,
        Stamina:   1n,
        Dexterity: 2n,
        Luck:      3n,
        Willpower: 4n,
    },

    // Variable names — read via getContractMemoryValue(name) in tests
    Vars: {
        Hitpoints:    'hitpoints',
        MaxHitpoints: 'maxHitpoints',
        IsDead:       'isDead',
        Level:        'level',
        Skillpoints:  'skillpoints',
        Strength:     'attrs[0]',
        Stamina:      'attrs[1]',
        Dexterity:    'attrs[2]',
        Luck:         'attrs[3]',
        Willpower:    'attrs[4]',
        MaxInvSlots:  'maxInvSlots',
        OccupiedInvSlots: 'occupiedInvSlots',
    },

    // KKV map keys — only for dynamic-key structures
    Maps: {
        LevelThreshold: 500n,  // key2 = level number
    },

    StatusEffects: {
        None:     0n,
        Frozen:   1n,
        Stunned:  2n,
        Weakened: 3n,
    },
} as const;
