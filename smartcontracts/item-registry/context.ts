import { join } from 'path';

export const Context = {
    ContractPath: join(__dirname + '/item-registry.contract.smart.c'),
    CreatorAccount: 555n,
    GamemasterAccount: 555n,
    ThisContract: 888n,
    Methods: {
        RegisterItem:   1n,
        UnregisterItem: 2n,
    },
    Props: {
        ItemType:     1n,
        EffectTarget: 2n,
        BonusAbs:     3n,
        BonusRel:     4n,
        StackLimit:   5n,
        MinLevel:     6n,
        IsBurnable:   7n,
    },
    ItemTypes: {
        Equipment:  1n,
        Consumable: 2n,
    },
    Targets: {
        Attack:    0n,
        HP:        1n,
        Strength:  2n,
        Stamina:   3n,
        Dexterity: 4n,
        Luck:      5n,
        Willpower: 6n,
        InvSlots:  7n,
    },
} as const;
