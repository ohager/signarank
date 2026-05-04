import {useQuery} from '@tanstack/react-query';
import {useSignumLedger} from './useSignumLedger';
import {resolveAccount} from '@lib/construct/accountCache';
import {POLLING_INTERVALS} from '@lib/construct/constants';

export interface RankingEntry {
    rank: number;
    account: string;
    accountRS: string;
    name: string | null;
    damageDealt: number;
    sharePercent: number;
}

export const useConstructRanking = (
    hpTokenId: string | null,
    maxHp: number,
    contractId: string | null,
): { ranking: RankingEntry[]; loading: boolean } => {
    const ledger = useSignumLedger();

    const {data: ranking = [], isLoading: loading} = useQuery({
        queryKey: ['constructRanking', hpTokenId],
        queryFn: async (): Promise<RankingEntry[]> => {
            if (!ledger || !hpTokenId) return [];

            const result = await ledger.asset.getAssetHolders({
                assetId: hpTokenId,
                ignoreTreasuryAccount: true,
                firstIndex: 0,
                lastIndex: 19,
            });

            const holders = (result.accountAssets || [])
                .filter(h => h.account !== contractId)
                .slice(0, 10);

            const resolvedAccounts = await Promise.all(
                holders.map(h => resolveAccount(ledger, h.account))
            );

            return holders.map((holder, idx) => {
                const damage = parseInt(holder.quantityQNT || '0');
                return {
                    rank: idx + 1,
                    account: holder.account,
                    accountRS: holder.accountRS,
                    name: resolvedAccounts[idx]?.name ?? null,
                    damageDealt: damage,
                    sharePercent: maxHp > 0 ? (damage / maxHp) * 100 : 0,
                };
            });
        },
        enabled: !!ledger && !!hpTokenId,
        staleTime: 30 * 1000,
        refetchInterval: POLLING_INTERVALS.attackHistory,
        refetchOnWindowFocus: false,
        placeholderData: (prev: any) => prev,
    });

    return {ranking, loading};
};
