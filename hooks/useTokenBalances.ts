import { useQuery } from '@tanstack/react-query';
import { POLLING_INTERVALS } from '@lib/construct/constants';
import { useSignumLedger } from './useSignumLedger';

interface TokenBalancesData {
    balances: Record<string, number>;
    signaBalance: number;
}

interface UseTokenBalancesResult {
    balances: Record<string, number>;
    signaBalance: number;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export const useTokenBalances = (
    accountId: string | null,
    tokenIds: string[]
): UseTokenBalancesResult => {
    const ledger = useSignumLedger();

    const { data, isLoading, error, refetch } = useQuery<TokenBalancesData>({
        queryKey: ['tokenBalances', accountId, tokenIds],
        queryFn: async () => {
            const account = await ledger!.account.getAccount({ accountId: accountId! });

            const signaBalance = parseInt(account.balanceNQT || '0') / 1e8;

            const tokenBalances: Record<string, number> = {};
            if (account.assetBalances) {
                for (const assetBalance of account.assetBalances) {
                    if (tokenIds.includes(assetBalance.asset)) {
                        tokenBalances[assetBalance.asset] = parseInt(assetBalance.balanceQNT || '0');
                    }
                }
            }
            for (const tokenId of tokenIds) {
                if (!(tokenId in tokenBalances)) {
                    tokenBalances[tokenId] = 0;
                }
            }

            return { balances: tokenBalances, signaBalance };
        },
        enabled: !!ledger && !!accountId,
        staleTime: POLLING_INTERVALS.tokenBalances / 2,
        refetchInterval: POLLING_INTERVALS.tokenBalances,
        refetchOnWindowFocus: false,
        placeholderData: (prev) => prev,
    });

    return {
        balances: data?.balances ?? {},
        signaBalance: data?.signaBalance ?? 0,
        loading: isLoading,
        error: error?.message ?? null,
        refetch,
    };
};
