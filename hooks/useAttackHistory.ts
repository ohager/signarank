import { useQuery } from 'react-query';
import { AttackRecord } from '@lib/construct/types';
import { POLLING_INTERVALS } from '@lib/construct/constants';
import { useSignumLedger } from './useSignumLedger';
import {ChainTime} from "@signumjs/util";

interface UseAttackHistoryResult {
    attacks: AttackRecord[];
    loading: boolean;
    error: string | null;
}

export const useAttackHistory = (
    contractId: string | null,
    xpTokenId: string | null
): UseAttackHistoryResult => {
    const ledger = useSignumLedger();

    const { data: attacks = [], isLoading: loading, error: queryError } = useQuery(
        ['attackHistory', contractId, xpTokenId],
        async () => {
            if (!ledger || !contractId || !xpTokenId) {
                return [];
            }

            // Get XP token transfers FROM the contract (outgoing = damage dealt)
            const transfers = await ledger.asset.getAssetTransfers({
                assetId: xpTokenId,
                accountId: contractId,
                firstIndex: 0,
                lastIndex: 9, // Last 10
            });

            const attackRecords: AttackRecord[] = [];

            for (const transfer of transfers.transfers || []) {
                // Only include outgoing transfers (contract is sender)
                if (transfer.senderRS === transfer.recipientRS) continue;

                // Try to get attacker name
                let attackerName: string | undefined;
                try {
                    const account = await ledger.account.getAccount({
                        accountId: transfer.recipientRS,
                    });
                    attackerName = account.name;
                } catch {
                    // Account may not have a name
                }

                attackRecords.push({
                    txId: transfer.assetTransfer,
                    attacker: transfer.recipientRS,
                    attackerName,
                    damage: parseInt(transfer.quantityQNT || '0'),
                    timestamp: ChainTime.fromChainTimestamp(transfer.timestamp).getEpoch(),
                    blockHeight: transfer.height,
                });
            }

            return attackRecords;
        },
        {
            enabled: !!ledger && !!contractId && !!xpTokenId,
            staleTime: 30 * 1000, // Consider data fresh for 30 seconds
            refetchInterval: POLLING_INTERVALS.attackHistory, // Refetch every 60 seconds
            refetchOnWindowFocus: false,
            keepPreviousData: true, // Prevents flashing
        }
    );

    return {
        attacks,
        loading,
        error: queryError ? String(queryError) : null
    };
};
