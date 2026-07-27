// hooks/useCharacterCreationProgress.ts
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Ledger } from '@signumjs/core';
import { useSignumLedger } from '@hooks/useSignumLedger';
import { deriveProgressState } from '@lib/character/creationProgress';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';

export interface CreationProgress {
    /** Only ever 'pending' | 'deployed' | 'funding_settled' | 'live' here —
     * 'needs_funding' and 'failed' are handled before this hook is used. */
    state: PendingCharacterState;
    elapsedMs: number;
}

const POLL_INTERVAL_MS = 15 * 1000;

async function fetchProgressState(ledger: Ledger, tx1Id: string, tx2Id: string): Promise<PendingCharacterState> {
    const [tx1, tx2] = await Promise.all([
        ledger.transaction.getTransaction(tx1Id),
        ledger.transaction.getTransaction(tx2Id),
    ]);
    // Absent `confirmations` means still in the mempool (never included in a
    // block yet); present means >= 0 confirmations.
    return deriveProgressState(tx1.confirmations ?? -1, tx2.confirmations ?? -1);
}

export const useCharacterCreationProgress = (tx1Id: string | null, tx2Id: string | null): CreationProgress => {
    const ledger = useSignumLedger();
    const startRef = useRef(Date.now());
    const [elapsedMs, setElapsedMs] = useState(0);

    const { data: state = 'pending' } = useQuery({
        queryKey: ['characterProgress', tx1Id, tx2Id],
        queryFn: () => {
            if (!ledger || !tx1Id || !tx2Id) return Promise.resolve<PendingCharacterState>('pending');
            return fetchProgressState(ledger, tx1Id, tx2Id);
        },
        enabled: !!ledger && !!tx1Id && !!tx2Id,
        refetchInterval: query => (query.state.data === 'live' ? false : POLL_INTERVAL_MS),
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (!tx1Id || !tx2Id || state === 'live') return;
        const timer = setInterval(() => setElapsedMs(Date.now() - startRef.current), 1000);
        return () => clearInterval(timer);
    }, [tx1Id, tx2Id, state]);

    return { state, elapsedMs };
};
