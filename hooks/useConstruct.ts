import {useQuery} from '@tanstack/react-query';
import {ConstructData} from '@lib/construct/types';
import {ConstructCache} from '@lib/construct/cache';
import {R2_CDN_BASE, POLLING_INTERVALS} from '@lib/construct/constants';
import {useSignumLedger} from './useSignumLedger';
import {ReadOnlyPlayer} from "@signarank/client"

interface UseConstructResult {
    construct: ConstructData | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export const useConstruct = (contractId: string | null): UseConstructResult => {
    const ledger = useSignumLedger();

    const {data: construct, isLoading: loading, error: queryError, refetch} = useQuery({
        queryKey: ['construct', contractId],
        queryFn: async () => {
            if (!contractId) return null;
            if (!ledger) return null;

            const cachedDefeated = ConstructCache.getDefeatedStatus(contractId);
            if (cachedDefeated?.constructData) {
                return cachedDefeated.constructData;
            }

            const player = new ReadOnlyPlayer({ledger, accountId: ''});
            const contractService = player.constructService.with(contractId);
            const [metadata, status, contract] = await Promise.all([
                contractService.getMetadata(),
                contractService.getStatus(),
                contractService.getContract(),
            ]);

            const imageUrl = metadata.avatar
                ? `${R2_CDN_BASE}/${metadata.avatar.ipfsCid}`
                : '';

            const data: ConstructData = {
                contractId,
                name: metadata.name,
                description: metadata.description,
                imageUrl,
                currentHp: Number(status.hitpoints),
                maxHp: status.maxHp,
                coolDownInBlocks: status.coolDownInBlocks,
                baseDamageRatio: status.baseDamageRatio,
                breachLimit: status.breachLimit,
                isActive: status.isActive,
                isDefeated: status.isDefeated,
                xpTokenId: status.xpTokenId,
                hpTokenId: status.hpTokenId,
                rewardNftId: status.rewardNftId || null,
                firstBloodAccount: status.firstBloodAccount || null,
                finalBlowAccount: status.finalBlowAccount || null,
                minActivation: contract.minActivation,
            };

            ConstructCache.setConstructMeta(contractId, {
                contractId,
                name: data.name,
                description: data.description,
                imageUrl: data.imageUrl,
                maxHp: data.maxHp,
                coolDownInBlocks: data.coolDownInBlocks,
            });

            if (data.isDefeated) {
                ConstructCache.setDefeatedStatus(contractId, {
                    contractId,
                    finalBlowAccount: data.finalBlowAccount || '',
                    firstBloodAccount: data.firstBloodAccount || '',
                    defeatedAt: Date.now(),
                    constructData: data,
                });
            }

            return data;
        },
        enabled: !!contractId && !!ledger,
        staleTime: 20 * 1000,
        refetchInterval: POLLING_INTERVALS.currentHp,
        refetchOnWindowFocus: false,
        placeholderData: (prev: any) => prev,
    });

    return {
        construct: construct ?? null,
        loading,
        error: queryError ? String(queryError) : null,
        refetch
    };
};
