import { useQuery } from '@tanstack/react-query';
import { Transaction } from '@signumjs/core';
import { useSignumLedger } from './useSignumLedger';

export type AttackStatus = 'pending' | 'processing';

export interface PendingAttack {
    txId: string;
    sender: string;
    senderRS: string;
    amountNQT: string;
    timestamp: number;
    status: AttackStatus;
    confirmationsLeft?: number;
}

interface UsePendingAttacksResult {
    pendingAttacks: PendingAttack[];
    loading: boolean;
}

export const usePendingAttacks = (contractId: string | null): UsePendingAttacksResult => {
    const ledger = useSignumLedger();

    const { data: pendingAttacks = [], isLoading: loading } = useQuery({
        queryKey: ['pendingAttacks', contractId],
        queryFn: async () => {
            if (!ledger || !contractId) return [];

            // Fetch unconfirmed (mempool) and recent confirmed transactions in parallel
            const [unconfirmedResult, recentTxResult] = await Promise.all([
                ledger.transaction.getUnconfirmedTransactions(),
                ledger.account.getAccountTransactions({
                    accountId: contractId,
                    firstIndex: 0,
                    lastIndex: 19,
                }),
            ]);

            const results: PendingAttack[] = [];

            // Unconfirmed transactions to this contract = "pending"
            const ConfirmationsRequired = 2;
            const unconfirmedTxs = unconfirmedResult.unconfirmedTransactions || [];
            for (const tx of unconfirmedTxs) {
                if (tx.recipient === contractId) {
                    results.push({
                        txId: tx.transaction,
                        sender: tx.sender,
                        senderRS: tx.senderRS,
                        amountNQT: tx.amountNQT,
                        timestamp: tx.timestamp,
                        confirmationsLeft: ConfirmationsRequired + 1,
                        status: 'pending',
                    });
                }
            }

            // Recently confirmed transactions with 0-1 confirmations = "processing"
            const recentTxs = recentTxResult.transactions || [];
            for (const tx of recentTxs) {
                if (
                    tx.recipient === contractId &&
                    tx.confirmations !== undefined &&
                    tx.confirmations <= ConfirmationsRequired
                ) {
                    results.push({
                        txId: tx.transaction,
                        sender: tx.sender,
                        senderRS: tx.senderRS,
                        amountNQT: tx.amountNQT,
                        timestamp: tx.timestamp,
                        confirmationsLeft: Math.max(0, ConfirmationsRequired - tx.confirmations),
                        status: 'processing',
                    });
                }
            }

            return results;
        },
        enabled: !!ledger && !!contractId,
        refetchInterval: 15 * 1000,
        staleTime: 10 * 1000,
        refetchOnWindowFocus: false,
    });

    return { pendingAttacks, loading };
};
