/**
 * Construct Smart Contract Constants
 * Data indices and map IDs for reading contract state
 */

// Contract data variable indices (memory positions)
export const ContractDataIndex = {
    name: 4,
    xpTokenId: 5,
    maxHp: 6,
    baseDamageRatio: 7,
    breachLimit: 8,
    firstBloodBonus: 9,
    finalBlowBonus: 10,
    coolDownInBlocks: 11,
    isActive: 12,
    rewardNftId: 13,
    rewardDistribution_players: 14,
    rewardDistribution_treasury: 15,
    debuff_chance: 17,
    debuff_damageReduction: 18,
    debuff_maxStack: 19,
    regeneration_blockInterval: 20,
    regeneration_hitpoints: 21,
    regeneration_lastRegenerationBlock: 22,
    isDefeated: 23,
    firstBloodAccount: 24,
    finalBlowAccount: 25,
    hpTokenId: 26,
} as const;

// Contract map IDs for key-value storage
export const ContractMaps = {
    DamageMultiplier: 1,
    DamageAddition: 11,
    DamageTokenLimit: 12,
    AttackersLastAttack: 2,
    AttackersDebuff: 21,
    TokenDecimalsInfo: 3,
} as const;

// R2 CDN base URL for construct images
export const R2_CDN_BASE = 'https://r2.signarank.club';

// Average block time in milliseconds (~4 minutes)
export const BLOCK_TIME_MS = 4 * 60 * 1000;

// Polling intervals
export const POLLING_INTERVALS = {
    currentHp: 30 * 1000,       // 30 seconds
    attackHistory: 60 * 1000,   // 1 minute
    userCooldown: 30 * 1000,    // 30 seconds
} as const;

// Parse attack token IDs from environment variable
export function getAttackTokenIds(): string[] {
    const tokenIdsEnv = process.env.NEXT_PUBLIC_ATTACK_TOKEN_IDS || '';
    return tokenIdsEnv
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
}

// Get active construct contract ID from environment variable
export function getActiveConstructId(): string | null {
    return process.env.NEXT_PUBLIC_CONSTRUCT_CONTRACT_ID || null;
}
