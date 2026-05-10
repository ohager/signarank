import {useQuery} from '@tanstack/react-query';
import {ConstructData} from '@lib/construct/types';
import {ConstructCache} from '@lib/construct/cache';
import {R2_CDN_BASE, POLLING_INTERVALS} from '@lib/construct/constants';
import {useSignumLedger} from './useSignumLedger';
import {ReadOnlyPlayer} from "@signarank/client"
import {Amount} from "@signumjs/util"
import {getSeasonNameForContract} from '@lib/construct/seasonConstructs'
import {resolveDamageVariantUrl, resolveDisplayUrl} from '@lib/construct/damageVariants'

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


            const player = new ReadOnlyPlayer({ledger, accountId: ''});
            const contractService = player.constructService.with(contractId);
            const [metadata, status, contract] = await Promise.all([
                contractService.getMetadata(),
                contractService.getStatus(),
                contractService.getContract(),
            ]);

            const customImage = metadata.getCustomField('xav') as string | undefined;
            const ipfsCid = metadata.avatar?.ipfsCid ? metadata.avatar.ipfsCid : null;
            const baseImageUrl = customImage || (ipfsCid ? `${R2_CDN_BASE}/${ipfsCid}` : '');

            const playersRewardPercent = status.rewardDistribution?.players ?? 85;
            const contractBalance = contract.balanceNQT ?? '0';
            const rewardPot = Amount.fromPlanck(contractBalance)
                .multiply(playersRewardPercent / 100)
                .getSigna();

            const hpPercent = status.maxHp > 0 ? Number(status.hitpoints) / status.maxHp : 1;
            const variantUrl = resolveDamageVariantUrl(ipfsCid, status.isDefeated, hpPercent * status.maxHp, status.maxHp);
            const imageUrl = variantUrl
                ? await resolveDisplayUrl(variantUrl, baseImageUrl)
                : baseImageUrl;

            const data: ConstructData = {
                contractId,
                name: metadata.name,
                description: metadata.description,
                imageUrl,
                ipfsCid,
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
                contractBalance,
                playersRewardPercent,
                rewardPot,
                debuffDamageReduction: status.debuff?.damageReduction ?? 0,
                debuffMaxStack: status.debuff?.maxStack ?? 0,
                regenHitpoints: status.regeneration?.hitpoints ?? 0,
                regenBlockInterval: status.regeneration?.blockInterval ?? 0,
                seasonName: getSeasonNameForContract(contractId),
            };

            ConstructCache.setConstructMeta(contractId, {
                contractId,
                name: data.name,
                description: data.description,
                imageUrl: data.imageUrl,
                maxHp: data.maxHp,
                coolDownInBlocks: data.coolDownInBlocks,
            });

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
        refetch,
    };
};
