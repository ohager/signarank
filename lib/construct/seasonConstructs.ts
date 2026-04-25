import seasons from '@lib/seasons.json';

export interface SeasonConstruct {
    contractId: string;
    order: number;
    locked: boolean;
}

function getNetworkKey(): 'testnet' | 'mainnet' {
    return process.env.NEXT_PUBLIC_SIGNUM_NETWORK?.includes('TESTNET') ? 'testnet' : 'mainnet';
}

export function getCurrentSeasonConstructs(): SeasonConstruct[] {
    const current = Object.values(seasons).find(s => s.isCurrent);
    if (!current) return [];

    const network = getNetworkKey();
    const pastIds    = (current.pastConstructs[network] ?? []) as string[];
    const currentIds = (current.constructs[network] ?? []) as string[];

    const all: SeasonConstruct[] = [];
    let order = 1;

    for (const id of pastIds)                  { all.push({ contractId: id, order: order++, locked: false }); }
    for (const id of currentIds)               { all.push({ contractId: id, order: order++, locked: false }); }
    for (const id of current.futureConstructs) { all.push({ contractId: id, order: order++, locked: true  }); }

    return all;
}

export function getSeasonNameForContract(contractId: string): string | null {
    const network = getNetworkKey();
    for (const [key, season] of Object.entries(seasons)) {
        if ((season.constructs[network] as string[])?.includes(contractId)) return key;
        if ((season.pastConstructs[network] as string[])?.includes(contractId)) return key;
    }
    return null;
}
