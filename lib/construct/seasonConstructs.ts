/**
 * Season Constructs Configuration
 * Defines all constructs for each season
 */

export interface SeasonConstruct {
    contractId: string;
    name: string;
    order: number; // Display order in the season
}

// Fallback for development when env var is not set
const FALLBACK_CONSTRUCT_ID = '12345678901234567890';

export const SEASON_CONSTRUCTS: Record<string, SeasonConstruct[]> = {
    frostfest: [
        {
            contractId: process.env.NEXT_PUBLIC_CONSTRUCT_CONTRACT_ID || FALLBACK_CONSTRUCT_ID,
            name: 'CT000001',
            order: 1,
        },
        // Add more constructs as they become available
        // These will be shown as "locked" until they're active or defeated
        {
            contractId: 'TBD_002',
            name: '???',
            order: 2,
        },
        {
            contractId: 'TBD_003',
            name: '???',
            order: 3,
        },
    ],
};

export function getSeasonConstructs(seasonKey: string): SeasonConstruct[] {
    return SEASON_CONSTRUCTS[seasonKey] || [];
}

export function getCurrentSeasonConstructs(): SeasonConstruct[] {
    // For now, hardcoded to frostfest
    // In the future, this would read from the current season
    return getSeasonConstructs('frostfest');
}
