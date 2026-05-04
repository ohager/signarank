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
        Attack:              1n,
        AllocateSkill:       2n,
        CollectItems:        3n,
        Migrate:             4n,
        EmergencyWithdraw:   5n,
        SetLevelThreshold:   6n,
        UseItem:             7n,
        CounterAttack:     100n,
        Buff:              102n,
        Debuff:            103n,
    },

    Attrs: {
        Strength:  1n,
        Stamina:   2n,
        Dexterity: 3n,
        Luck:      4n,
        Willpower: 5n,
    },

    // Variable names — read via getContractMemoryValue(name) in tests,
    // ContractDataView.getVariableAsDecimal(index) in production frontend
    Vars: {
        CharHp:          'charHp',
        CharMaxHp:       'charMaxHp',
        CharIsDead:      'charIsDead',
        CharLevel:       'charLevel',
        CharCreationPts: 'charCreationPts',
        CharSkillPts:    'charSkillPts',
        CharStrength:    'charAttrs_strength',
        CharStamina:     'charAttrs_stamina',
        CharDexterity:   'charAttrs_dexterity',
        CharLuck:        'charAttrs_luck',
        CharWillpower:   'charAttrs_willpower',
        CharInvCount:    'charInvCount',
        CharMaxInvSlots: 'charMaxInvSlots',
        FrozenUntil:     'frozenUntil',
        StunnedUntil:    'stunnedUntil',
        DebuffStacks:    'debuffStacks',
        EquipAtkAbs:     'equipAtkAbs',
        EquipAtkRel:     'equipAtkRel',
        EquipHpAbs:      'equipHpAbs',
        EquipStrBonus:   'equipStrBonus',
        EquipStaBonus:   'equipStaBonus',
        EquipDexBonus:   'equipDexBonus',
        EquipLckBonus:   'equipLckBonus',
        EquipWilBonus:   'equipWilBonus',
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
