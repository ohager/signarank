import {join} from 'path';


export const Context = {
    ContractPath: join(__dirname + '/construct.contract.smart.c'),
    NftContractPath: join(__dirname + '/nft.mock.contract.smart.c'),
    SenderAccount1: 10n,
    SenderAccount2: 20n,
    CreatorAccount: 555n,
    ThisContract: 999n, // only if NFT Contract is not loaded
    XPTokenId: 1000n,
    ActivationFee: 2_0000_0000n,
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
    },
    Maps: {
        DamageMultiplier: 1n,
        DamageAddition: 11n,
        DamageTokenLimit: 12n,
        AttackersLastAttack: 2n,
        AttackerDebuff: 21n,
        TokenDecimalsInfo: 3n
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
