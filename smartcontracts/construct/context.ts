import {join} from 'path';


export const Context = {
    ContractPath: join(__dirname + '/construct.contract.smart.c'),
    NftContractPath: join(__dirname + '/nft.mock.contract.smart.c'),
    // The construct now sources its XP token + trusted character hashes from the
    // gamemaster registry (single source of truth), so tests seed a real one.
    GamemasterRegistryPath: join(__dirname, '..', 'gamemaster-registry', 'gamemaster-registry.contract.smart.c'),
    GamemasterRegistryAddress: 122344543654n, // must match GAMEMASTER_REGISTRY in the contract
    SenderAccount1: 10n,
    SenderAccount2: 20n,
    CreatorAccount: 555n,
    // The EOA that owns (created) the character stand-in — getCreatorOf(character)
    // returns this, so reward routing to the owner is testable.
    CharacterOwnerAccount: 42n,
    ThisContract: 999n, // only if NFT Contract is not loaded
    XPTokenId: 1000n,
    ActivationFee: 2_0000_0000n,
    // gamemaster-registry method codes used to seed identities in tests.
    GamemasterMethods: {
        SetCharacterHash: 2n,
        SetXpToken: 4n,
        SetNextCharacterHash: 7n,
    },
    Methods: {
        SetActive: 1n,
        SetBreachLimit: 2n,
        SetDamageMultiplier: 3n,
        SetDamageAddition: 4n,
        SetRewardNft: 5n,
        SetRewardDistribution: 6n,
        SetBoni: 7n,
        SetDebuff: 8n,
        SetRegeneration: 9n,
        Heal: 10n,
        SetTokenDecimals: 11n,
        SetAttackerMode: 13n,
        SetCharacterDamage: 14n,
        SetEffectAffinity: 15n,
        SetDropToken: 16n,
        SetDropModifiers: 17n,
        SetLuckFactor: 18n,
        SetCounterDamage: 19n,
        SetCounterEffect: 20n,
    },
    MaxDropSlots: 5n,
    // The character's COMBAT method code — the construct SENDS this on a counter:
    // COMBAT(rawDamage, effectId, duration). effectId 0 = pure damage.
    CharCombat: 14n,
    // attacker-mode gate values (mirror ATTACKER_MODE_* in the contract)
    AttackerMode: {
        Any: 0n,
        CharacterOnly: 1n,
        EoaOnly: 2n,
    },
    // Character public-profile keys the construct reads via getExtMapValue —
    // mirror MAP_KEY1_COMBAT / MAP_KEY1_PROGRESSION and their key2 sub-ids in
    // character/character.contract.smart.c. Combat values are EFFECTIVE (base +
    // equipment) and published every activation.
    CharacterMap: {
        Combat: 4n,       // key1
        Strength: 1n,     // key2 under Combat (effective strength)
        Luck: 2n,         // key2 under Combat (effective luck)
        AttackAbs: 3n,    // key2 under Combat (equipped weapon flat attack)
        AttackRel: 4n,    // key2 under Combat (equipped weapon % attack)
        AttackEffect: 5n, // key2 under Combat (primary attack effect id / element)
        Progression: 3n,  // key1
        Level: 1n,        // key2 under Progression
    },
    Maps: {
        DamageMultiplier: 1n,
        DamageAddition: 11n,
        DamageTokenLimit: 12n,
        AttackersLastAttack: 2n,
        AttackerDebuff: 21n,
        TokenDecimalsInfo: 3n
    },
    // Item Registry property keys (shared with item-registry contract)
    ItemRegistryProps: {
        ItemType:     1n,
        EffectTarget: 2n,
        BonusAbs:     3n,
        BonusRel:     4n,
        StackLimit:   5n,
        MinLevel:     6n,
        IsBurnable:   7n,
    },
    Data: {
        name: 4n,
        xpTokenId: 5n,
        maxHp: 6n,
        baseDamageRatio: 7n,
        breachLimit: 8n,
        firstBloodBonus: 9n,
        finalBlowBonus: 10n,
        coolDownInBlocks: 11n,
        isActive: 12n,
        rewardNftId: 13n,
        rewardDistribution_players: 14n,
        rewardDistribution_treasury: 15n,
        debuff_chance: 17n,
        debuff_damageReduction: 18n,
        debuff_maxStack: 19n,
        regeneration_blockInterval: 20n,
        regeneration_hitpoints: 21n,
        regeneration_lastRegenerationBlock: 22n,
        isDefeated: 23n,
        // --- derived status
        firstBloodAccount: 24n,
        finalBlowAccount: 25n,
        hpTokenId: 26n
    }


}
