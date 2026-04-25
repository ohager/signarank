import { ConstructData } from '@lib/construct/types';
import { PlayerConstructStats } from '@hooks/usePlayerConstructStats';

export interface ComputeTagsInput {
    signaAmount: string;
    tokens: { tokenId: string; quantity: number }[];
    construct: ConstructData;
    playerStats: PlayerConstructStats | null;
}

export function computeNarrationTags(input: ComputeTagsInput): string[] {
    const { signaAmount, tokens, construct, playerStats } = input;
    const tags: string[] = [];

    const amount = Number(signaAmount) || 0;

    // impact
    let damage = amount * construct.baseDamageRatio;
    if (playerStats?.isDebuffed) {
        const effectiveStacks = Math.min(
            playerStats.debuffStacks,
            construct.debuffMaxStack
        );
        const reduction = effectiveStacks * construct.debuffDamageReduction;
        damage *= 1 - reduction / 100;
    }
    const damagePercent = construct.maxHp > 0 ? damage / construct.maxHp : 0;
    if (damagePercent >= 0.25) tags.push('looks_devastating');
    else if (damagePercent >= 0.08) tags.push('solid_hit');
    else tags.push('weak_strike');

    // attackerState
    tags.push(playerStats?.isDebuffed ? 'debuffed' : 'fresh');

    // stake
    if (amount >= 1000) tags.push('whale');
    else if (amount >= 100) tags.push('moderate');
    else tags.push('pocket_change');

    // constructHealth
    const hpRatio = construct.maxHp > 0
        ? construct.currentHp / construct.maxHp
        : 1;
    if (hpRatio <= 0.2) tags.push('barely_standing');
    else if (hpRatio <= 0.6) tags.push('half_health');
    else tags.push('full_health');

    // counterRisk
    tags.push('safe_attack');

    // token + tokenCount
    const activeTokens = tokens.filter(t => t.quantity > 0);
    // TODO: token_<element> mapping — skipping until token-id → element mapping is available
    if (activeTokens.length === 0) tags.push('no_token');
    else if (activeTokens.length === 1) tags.push('single_token');
    else tags.push('multi_token');

    return tags;
}
