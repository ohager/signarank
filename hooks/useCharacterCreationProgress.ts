// hooks/useCharacterCreationProgress.ts
import { useState, useEffect, useRef } from 'react';
import { useSignumLedger } from '@hooks/useSignumLedger';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';

export interface CreationProgress {
    /** Only ever 'pending' | 'deployed' | 'funding_settled' | 'live' here —
     * 'needs_funding' and 'failed' are handled before this hook is used. */
    state: PendingCharacterState;
    elapsedMs: number;
}

const POLL_INTERVAL_MS = 15 * 1000;

export const useCharacterCreationProgress = (tx1Id: string | null, tx2Id: string | null): CreationProgress => {
    const ledger = useSignumLedger();
    const [state, setState] = useState<PendingCharacterState>('pending');
    const [elapsedMs, setElapsedMs] = useState(0);
    const startRef = useRef(Date.now());

    useEffect(() => {
        if (!tx1Id || !tx2Id || !ledger || state === 'live') return;

        let cancelled = false;

        const poll = async () => {
            try {
                const [tx1, tx2] = await Promise.all([
                    ledger.transaction.getTransaction(tx1Id),
                    ledger.transaction.getTransaction(tx2Id),
                ]);
                if (cancelled) return;

                // Absent `confirmations` means still in the mempool (never
                // included in a block yet); present means >= 0 confirmations.
                const tx1Confirmations = tx1.confirmations ?? -1;
                const tx2Confirmations = tx2.confirmations ?? -1;

                if (tx2Confirmations >= 1) {
                    setState('live');
                } else if (tx2Confirmations >= 0) {
                    setState('funding_settled');
                } else if (tx1Confirmations >= 0) {
                    setState('deployed');
                } else {
                    setState('pending');
                }
            } catch {
                // Transient node error (e.g. tx not yet relayed to this
                // node) — keep the previous state, try again next tick.
            }
        };

        void poll();
        const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
        const elapsedTimer = setInterval(() => setElapsedMs(Date.now() - startRef.current), 1000);

        return () => {
            cancelled = true;
            clearInterval(pollTimer);
            clearInterval(elapsedTimer);
        };
    }, [tx1Id, tx2Id, ledger, state]);

    return { state, elapsedMs };
};
