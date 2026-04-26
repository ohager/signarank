/**
 * Construct (Monster) Game Types
 */

export interface ConstructData {
    contractId: string;
    name: string;
    description: string;
    imageUrl: string;
    currentHp: number;
    maxHp: number;
    coolDownInBlocks: number;
    baseDamageRatio: number;
    breachLimit: number;
    isActive: boolean;
    isDefeated: boolean;
    xpTokenId: string;
    hpTokenId: string;
    rewardNftId: string | null;
    firstBloodAccount: string | null;
    finalBlowAccount: string | null;
    /** Minimum activation amount in Planck needed to trigger the contract */
    minActivation: string;
    /** Contract SIGNA balance in Planck */
    contractBalance: string;
    /** Percentage of the contract balance distributed to players (e.g. 85) */
    playersRewardPercent: number;
    /** Current reward pot in SIGNA (balance × playersRewardPercent / 100) */
    rewardPot: string;
    /** Debuff damage reduction per stack (percent) */
    debuffDamageReduction: number;
    /** Debuff maximum stack count */
    debuffMaxStack: number;
    /** Season this construct belongs to (e.g. "frostfest") */
    seasonName: string | null;
    /** HP restored per regen tick (0 = no regen) */
    regenHitpoints: number;
    /** Blocks between regen ticks (0 = no regen) */
    regenBlockInterval: number;
}

export interface ConstructMeta {
    contractId: string;
    name: string;
    description: string;
    imageUrl: string;
    maxHp: number;
    coolDownInBlocks: number;
}

export interface DefeatedStatus {
    contractId: string;
    finalBlowAccount: string;
    firstBloodAccount: string;
    defeatedAt: number;
    /** Full construct snapshot cached at time of defeat */
    constructData?: ConstructData;
}

export interface AttackRecord {
    txId: string;
    attacker: string;
    attackerName?: string;
    attackerXp: number;
    damage: number;
    timestamp: number;
    blockHeight: number;
}

export interface TokenMeta {
    tokenId: string;
    name: string;
    symbol?: string;
    decimals: number;
    iconUrl?: string;
    description?: string;
}

export interface AttackToken extends TokenMeta {
    balance: number;
    quantity: number;
}

export interface UserCooldownStatus {
    isInCooldown: boolean;
    lastAttackBlock: number;
    currentBlock: number;
    blocksRemaining: number;
    cooldownEndsAt: Date | null;
}

export interface AttackParams {
    contractId: string;
    signaAmount: string;
    tokens?: Array<{ tokenId: string; quantity: string; decimals: number }>;
}

export interface AttackResult {
    success: boolean;
    txId?: string;
    error?: string;
    cancelled?: boolean;
}
