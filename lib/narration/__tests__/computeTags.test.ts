import { describe, it, expect } from 'vitest';
import { computeNarrationTags, ComputeTagsInput } from '../computeTags';
import { ConstructData } from '@lib/construct/types';
import { PlayerConstructStats } from '@hooks/usePlayerConstructStats';

function makeConstruct(overrides: Partial<ConstructData> = {}): ConstructData {
    return {
        contractId: '123',
        name: 'CT000001',
        description: '',
        imageUrl: '',
        currentHp: 1000,
        maxHp: 1000,
        coolDownInBlocks: 10,
        baseDamageRatio: 1,
        breachLimit: 500,
        isActive: true,
        isDefeated: false,
        xpTokenId: 'xp1',
        hpTokenId: 'hp1',
        rewardNftId: null,
        firstBloodAccount: null,
        finalBlowAccount: null,
        minActivation: '100000000',
        contractBalance: '0',
        playersRewardPercent: 85,
        rewardPot: '0',
        debuffDamageReduction: 10,
        debuffMaxStack: 5,
        regenHitpoints: 0,
        regenBlockInterval: 0,
        seasonName: 'frostfest',
        ...overrides,
    };
}

function makeStats(overrides: Partial<PlayerConstructStats> = {}): PlayerConstructStats {
    return {
        damageDealt: 0,
        xpTotal: 0,
        isDebuffed: false,
        debuffStacks: 0,
        debuffReductionPercent: 0,
        blocksLeftUntilNextAttack: 0,
        canAttack: true,
        ...overrides,
    };
}

describe('computeNarrationTags', () => {
    describe('impact', () => {
        it('returns looks_devastating for >= 25% maxHp damage', () => {
            const tags = computeNarrationTags({
                signaAmount: '300',
                tokens: [],
                construct: makeConstruct({ maxHp: 1000, baseDamageRatio: 1 }),
                playerStats: null,
            });
            expect(tags).toContain('looks_devastating');
        });

        it('returns solid_hit for >= 8% maxHp damage', () => {
            const tags = computeNarrationTags({
                signaAmount: '100',
                tokens: [],
                construct: makeConstruct({ maxHp: 1000, baseDamageRatio: 1 }),
                playerStats: null,
            });
            expect(tags).toContain('solid_hit');
        });

        it('returns weak_strike for < 8% maxHp damage', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [],
                construct: makeConstruct({ maxHp: 1000, baseDamageRatio: 1 }),
                playerStats: null,
            });
            expect(tags).toContain('weak_strike');
        });

        it('applies debuff reduction to damage', () => {
            const tags = computeNarrationTags({
                signaAmount: '250',
                tokens: [],
                construct: makeConstruct({ maxHp: 1000, baseDamageRatio: 1, debuffDamageReduction: 10, debuffMaxStack: 5 }),
                playerStats: makeStats({ isDebuffed: true, debuffStacks: 3 }),
            });
            // 250 * 1 * (1 - 30/100) = 175 = 17.5% → solid_hit
            expect(tags).toContain('solid_hit');
        });
    });

    describe('attackerState', () => {
        it('returns debuffed when player is debuffed', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [],
                construct: makeConstruct(),
                playerStats: makeStats({ isDebuffed: true }),
            });
            expect(tags).toContain('debuffed');
            expect(tags).not.toContain('fresh');
        });

        it('returns fresh when player is not debuffed', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [],
                construct: makeConstruct(),
                playerStats: makeStats({ isDebuffed: false }),
            });
            expect(tags).toContain('fresh');
        });

        it('returns fresh when playerStats is null', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [],
                construct: makeConstruct(),
                playerStats: null,
            });
            expect(tags).toContain('fresh');
        });
    });

    describe('stake', () => {
        it('returns whale for >= 1000 SIGNA', () => {
            const tags = computeNarrationTags({
                signaAmount: '1000',
                tokens: [],
                construct: makeConstruct(),
                playerStats: null,
            });
            expect(tags).toContain('whale');
        });

        it('returns moderate for >= 100 SIGNA', () => {
            const tags = computeNarrationTags({
                signaAmount: '500',
                tokens: [],
                construct: makeConstruct(),
                playerStats: null,
            });
            expect(tags).toContain('moderate');
        });

        it('returns pocket_change for < 100 SIGNA', () => {
            const tags = computeNarrationTags({
                signaAmount: '50',
                tokens: [],
                construct: makeConstruct(),
                playerStats: null,
            });
            expect(tags).toContain('pocket_change');
        });
    });

    describe('constructHealth', () => {
        it('returns barely_standing for <= 20% HP', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [],
                construct: makeConstruct({ currentHp: 150, maxHp: 1000 }),
                playerStats: null,
            });
            expect(tags).toContain('barely_standing');
        });

        it('returns half_health for <= 60% HP', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [],
                construct: makeConstruct({ currentHp: 500, maxHp: 1000 }),
                playerStats: null,
            });
            expect(tags).toContain('half_health');
        });

        it('returns full_health for > 60% HP', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [],
                construct: makeConstruct({ currentHp: 800, maxHp: 1000 }),
                playerStats: null,
            });
            expect(tags).toContain('full_health');
        });
    });

    describe('counterRisk', () => {
        it('always returns safe_attack', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [],
                construct: makeConstruct(),
                playerStats: null,
            });
            expect(tags).toContain('safe_attack');
        });
    });

    describe('tokenCount', () => {
        it('returns no_token when no tokens selected', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [],
                construct: makeConstruct(),
                playerStats: null,
            });
            expect(tags).toContain('no_token');
        });

        it('returns single_token for one token', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [{ tokenId: 't1', quantity: 5 }],
                construct: makeConstruct(),
                playerStats: null,
            });
            expect(tags).toContain('single_token');
        });

        it('returns multi_token for two or more tokens', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [
                    { tokenId: 't1', quantity: 5 },
                    { tokenId: 't2', quantity: 3 },
                ],
                construct: makeConstruct(),
                playerStats: null,
            });
            expect(tags).toContain('multi_token');
        });

        it('ignores tokens with quantity 0', () => {
            const tags = computeNarrationTags({
                signaAmount: '10',
                tokens: [
                    { tokenId: 't1', quantity: 0 },
                    { tokenId: 't2', quantity: 5 },
                ],
                construct: makeConstruct(),
                playerStats: null,
            });
            expect(tags).toContain('single_token');
        });
    });
});
