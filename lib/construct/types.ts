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
}

export interface AttackRecord {
    txId: string;
    attacker: string;
    attackerName?: string;
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
    tokens?: Array<{ tokenId: string; quantity: string }>;
}

export interface AttackResult {
    success: boolean;
    txId?: string;
    error?: string;
}
