import {useQuery} from 'react-query';
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

    const {data: construct, isLoading: loading, error: queryError, refetch} = useQuery(
        ['construct', contractId],
        async () => {
            if (!contractId) return null;
            if (!ledger) return null;

            const cachedDefeated = ConstructCache.getDefeatedStatus(contractId);
            if (cachedDefeated) {
                const cachedMeta = ConstructCache.getConstructMeta(contractId);
                if (cachedMeta) {
                    return {
                        contractId,
                        name: cachedMeta.name,
                        description: cachedMeta.description,
                        imageUrl: cachedMeta.imageUrl,
                        maxHp: cachedMeta.maxHp,
                        coolDownInBlocks: cachedMeta.coolDownInBlocks,
                        currentHp: 0,
                        baseDamageRatio: 0,
                        breachLimit: 0,
                        isActive: false,
                        isDefeated: true,
                        xpTokenId: '',
                        hpTokenId: '',
                        rewardNftId: null,
                        firstBloodAccount: cachedDefeated.firstBloodAccount,
                        finalBlowAccount: cachedDefeated.finalBlowAccount,
                    } as ConstructData;
                }
            }

            const player = new ReadOnlyPlayer({ledger, accountId: ''});
            const instance = player.constructService.with(contractId);
            const [metadata, status] = await Promise.all([
                instance.getMetadata(),
                instance.getStatus(),
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
                });
            }

            return data;
        },
        {
            enabled: !!contractId && !!ledger,
            staleTime: 20 * 1000,
            refetchInterval: POLLING_INTERVALS.currentHp,
            refetchOnWindowFocus: false,
            keepPreviousData: true,
        }
    );

    return {
        construct: construct ?? null,
        loading,
        error: queryError ? String(queryError) : null,
        refetch: () => {
            refetch();
        }
    };
};
