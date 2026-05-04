import {useQuery} from '@tanstack/react-query';
import {useSignumLedger} from './useSignumLedger';
import {resolveAccount} from '@lib/construct/accountCache';
import {getSignaRankTokenId} from '@lib/construct/constants';
import seasons from '@lib/seasons.json';
import type {Account} from "@signumjs/core";

export interface XpLeaderboardEntry {
    rank: number;
    account: string;
    accountRS: string;
    name: string | null;
    xp: number;
}

function getAllConstructIds(): Set<string> {
    const ids = new Set<string>();
    for (const season of Object.values(seasons)) {
        for (const networkIds of Object.values(season.constructs)) {
            for (const id of networkIds as string[]) ids.add(id);
        }
        for (const networkIds of Object.values(season.pastConstructs)) {
            for (const id of networkIds as string[]) ids.add(id);
        }
        for (const id of season.futureConstructs as string[]) ids.add(id);
    }
    return ids;
}

export const useXpLeaderboard = (): { entries: XpLeaderboardEntry[]; loading: boolean } => {
    const ledger = useSignumLedger();
    const tokenId = getSignaRankTokenId();

    const {data: entries = [], isLoading: loading} = useQuery({
        queryKey: ['xpLeaderboard', tokenId],
        queryFn: async (): Promise<XpLeaderboardEntry[]> => {
            if (!ledger || !tokenId) return [];

            const [holdersResult, asset] = await Promise.all([
                ledger.asset.getAssetHolders({
                    assetId: tokenId,
                    ignoreTreasuryAccount: true,
                    firstIndex: 0,
                    lastIndex: 149,
                }),
                ledger.asset.getAsset({assetId: tokenId}),
            ]);

            const holders = (holdersResult.accountAssets || [])
                .slice(0, 50);

            const resolvedAccounts = await Promise.all(
                holders.map(h => resolveAccount(ledger, h.account))
            );

            // TODO: once the character accounts are out, we need to change this
            const accounts = new Map<string, {id: string, name: string, excluded: boolean}>(resolvedAccounts.map( a => [a!.account, {id: a!.account, name: a!.name, excluded: a!.isAT}]))
            accounts.set(asset.issuer, {id: asset.issuer, name: '', excluded: true})

            return holders.filter( holder => !accounts.get(holder.account)?.excluded).map((holder, idx) => ({
                rank: idx + 1,
                account: holder.account,
                accountRS: holder.accountRS,
                name: accounts.get(holder.account)?.name ?? null,
                xp: parseInt(holder.quantityQNT || '0'),
            }));
        },
        enabled: !!ledger && !!tokenId,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    return {entries, loading};
};
