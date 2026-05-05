import {useQuery} from '@tanstack/react-query';
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

    const {data: attacks = [], isLoading: loading, error: queryError} = useQuery({
        queryKey: ['attackHistory', contractId, xpTokenId],
        queryFn: async () => {
            if (!ledger || !contractId || !xpTokenId) {
                return [];
            }

            const transfers = await ledger.asset.getAssetTransfers({
                assetId: xpTokenId,
                accountId: contractId,
                firstIndex: 0,
                lastIndex: 99,
            });

            const attackRecords: AttackRecord[] = [];
            const signaRankTokenId = getSignaRankTokenId()
            for (const transfer of transfers.transfers || []) {
                if (transfer.sender !== contractId) continue;
                if (attackRecords.length >= 50) break;

                const resolved = await resolveAccount(ledger, transfer.recipient);

                const {name: attackerName, assetBalances} = resolved!

                const xpToken = assetBalances?.find(ab => ab.asset === signaRankTokenId)
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
        enabled: !!ledger && !!contractId && !!xpTokenId,
        staleTime: 30 * 1000,
        refetchInterval: POLLING_INTERVALS.attackHistory,
        refetchOnWindowFocus: false,
        placeholderData: (prev: any) => prev,
    });

    return {
        attacks,
        loading,
        error: queryError ? String(queryError) : null
    };
};
