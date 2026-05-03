import { join } from 'path';

export const Context = {
    ContractPath: join(__dirname + '/character.contract.smart.c'),
    ItemRegistryPath: join(__dirname + '../item-registry/item-registry.contract.smart.c'),
    OwnerAccount: 10n,
    // When character loads alone it deploys at 999n;
    // when item registry loads first, character deploys at 1000n.
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
        // Incoming from Construct
        CounterAttack:     100n,
        Buff:              102n,
        Debuff:            103n,
    },

    Attrs: {
        Strength:  0n,
        Stamina:   1n,
        Dexterity: 2n,
        Luck:      3n,
        Willpower: 4n,
    },

    // KKV map keys — must match contract #defines
    Maps: {
        CharStrength:    100n,
        CharStamina:     101n,
        CharDexterity:   102n,
        CharLuck:        103n,
        CharWillpower:   104n,
        CharHp:          200n,
        CharMaxHp:       201n,
        CharIsDead:      202n,
        CharLevel:       203n,
        CharSkillPts:    204n,
        CharInvCount:    205n,
        CharMaxInvSlots: 206n,
        FrozenUntil:     300n,
        StunnedUntil:    301n,
        DebuffStacks:    302n,
        EquipAtkAbs:     400n,
        EquipAtkRel:     401n,
        EquipHpAbs:      402n,
        EquipStrBonus:   403n,
        EquipStaBonus:   404n,
        EquipDexBonus:   405n,
        EquipLckBonus:   406n,
        EquipWilBonus:   407n,
        LevelThreshold:  500n,
    },

    StatusEffects: {
        None:     0n,
        Frozen:   1n,
        Stunned:  2n,
        Weakened: 3n,
    },

    // Item registry prop keys (shared with item-registry contract)
    RegistryProps: {
        ItemType:     1n,
        EffectTarget: 2n,
        BonusAbs:     3n,
        BonusRel:     4n,
        StackLimit:   5n,
        MinLevel:     6n,
        IsBurnable:   7n,
    },
} as const;
