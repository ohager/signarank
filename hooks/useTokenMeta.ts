import { useState, useEffect } from 'react';
import { TokenMeta } from '@lib/construct/types';
import { loadMultipleTokenMeta } from '@lib/construct/tokenLoader';
import { useSignumLedger } from './useSignumLedger';

interface UseTokenMetaResult {
    tokens: TokenMeta[];
    loading: boolean;
    error: string | null;
}

export const useTokenMeta = (tokenIds: string[]): UseTokenMetaResult => {
    const [tokens, setTokens] = useState<TokenMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const ledger = useSignumLedger();

    useEffect(() => {
        if (!ledger || tokenIds.length === 0) {
            setLoading(false);
            return;
        }

        const fetchTokens = async () => {
            try {
                setLoading(true);
                setError(null);

                const tokenMetas = await loadMultipleTokenMeta(ledger, tokenIds);
                setTokens(tokenMetas);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load token metadata');
            } finally {
                setLoading(false);
            }
        };

        fetchTokens();
    }, [ledger, tokenIds.join(',')]);

    return { tokens, loading, error };
};
