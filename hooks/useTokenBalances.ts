import { useState, useEffect, useCallback } from 'react';
import { useSignumLedger } from './useSignumLedger';

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
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [signaBalance, setSignaBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const ledger = useSignumLedger();

    const fetchBalances = useCallback(async () => {
        if (!ledger || !accountId) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Fetch account to get SIGNA balance and asset balances
            const account = await ledger.account.getAccount({ accountId });

            // SIGNA balance (convert from Planck)
            const signa = parseInt(account.balanceNQT || '0') / 1e8;
            setSignaBalance(signa);

            // Token balances
            const tokenBalances: Record<string, number> = {};

            if (account.assetBalances) {
                for (const assetBalance of account.assetBalances) {
                    if (tokenIds.includes(assetBalance.asset)) {
                        // Store raw quantity (in smallest unit)
                        tokenBalances[assetBalance.asset] = parseInt(assetBalance.balanceQNT || '0');
                    }
                }
            }

            // Initialize missing tokens with 0 balance
            for (const tokenId of tokenIds) {
                if (!(tokenId in tokenBalances)) {
                    tokenBalances[tokenId] = 0;
                }
            }

            setBalances(tokenBalances);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch balances');
        } finally {
            setLoading(false);
        }
    }, [ledger, accountId, tokenIds.join(',')]);

    useEffect(() => {
        fetchBalances();
    }, [fetchBalances]);

    return { balances, signaBalance, loading, error, refetch: fetchBalances };
};
