/**
 * Season Constructs Configuration
 *
 * Three env vars drive the season construct list, displayed in this order:
 *   NEXT_PUBLIC_SEASON_PAST_CONSTRUCT_IDS    – defeated constructs (real IDs)
 *   NEXT_PUBLIC_SEASON_CONSTRUCT_IDS         – active/current constructs (real IDs)
 *   NEXT_PUBLIC_SEASON_FUTURE_CONSTRUCT_IDS  – upcoming slots (any placeholder string, shown as "Coming Soon")
 */

export interface SeasonConstruct {
    contractId: string;
    order: number;
    locked: boolean; // true = coming soon, don't fetch from chain
}

function splitIds(raw: string | undefined): string[] {
    return (raw || '')
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);
}

export function getCurrentSeasonConstructs(): SeasonConstruct[] {
    const past = splitIds(process.env.NEXT_PUBLIC_SEASON_PAST_CONSTRUCT_IDS);
    const current = splitIds(process.env.NEXT_PUBLIC_SEASON_CONSTRUCT_IDS);
    const future = splitIds(process.env.NEXT_PUBLIC_SEASON_FUTURE_CONSTRUCT_IDS);

    // Fallback: single-construct setup via the legacy var
    if (past.length === 0 && current.length === 0 && future.length === 0) {
        const activeId = process.env.NEXT_PUBLIC_CONSTRUCT_CONTRACT_ID;
        if (!activeId) return [];
        return [{ contractId: activeId, order: 1, locked: false }];
    }

    const all: SeasonConstruct[] = [];
    let order = 1;

    for (const id of past)    { all.push({ contractId: id, order: order++, locked: false }); }
    for (const id of current) { all.push({ contractId: id, order: order++, locked: false }); }
    for (const id of future)  { all.push({ contractId: id, order: order++, locked: true  }); }

    return all;
}

export function getSeasonNameForContract(contractId: string): string | null {
    const past    = splitIds(process.env.NEXT_PUBLIC_SEASON_PAST_CONSTRUCT_IDS);
    const current = splitIds(process.env.NEXT_PUBLIC_SEASON_CONSTRUCT_IDS);

    if (past.includes(contractId) || current.includes(contractId)) return 'frostfest';

    const activeId = process.env.NEXT_PUBLIC_CONSTRUCT_CONTRACT_ID;
    if (activeId && contractId === activeId) return 'frostfest';

    return null;
}
