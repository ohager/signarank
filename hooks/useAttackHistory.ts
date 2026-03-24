import {useQuery} from 'react-query';
import {AttackRecord} from '@lib/construct/types';
import {getSignaRankTokenId, POLLING_INTERVALS} from '@lib/construct/constants';
import {resolveAccount} from '@lib/construct/accountCache';
import {useSignumLedger} from './useSignumLedger';

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

    const {data: attacks = [], isLoading: loading, error: queryError} = useQuery(
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
                lastIndex: 50, // Last 10
            });

            const attackRecords: AttackRecord[] = [];
            const signaRankTokenId = getSignaRankTokenId()
            for (const transfer of transfers.transfers || []) {
                // Only include outgoing transfers (contract is sender)
                if (transfer.sender !== contractId) continue;
                if (attackRecords.length >= 10) break;

                const resolved = await resolveAccount(ledger, transfer.recipient);

                const {name: attackerName, assetBalances} = resolved!

                const xpToken = assetBalances.find(ab => ab.asset === signaRankTokenId)
                const attackerXp = Number(xpToken?.balanceQNT || 0)
                attackRecords.push({
                    txId: transfer.assetTransfer,
                    attacker: transfer.recipientRS,
                    attackerName,
                    attackerXp,
                    damage: parseInt(transfer.quantityQNT || '0'),
                    timestamp: transfer.timestamp,
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
