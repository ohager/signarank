import {useQuery} from '@tanstack/react-query';
import {ReadOnlyPlayer} from '@signarank/client';
import {ContractMaps, POLLING_INTERVALS} from '@lib/construct/constants';
import {useSignumLedger} from './useSignumLedger';

export interface PlayerConstructStats {
    /** Number of HP tokens held by player — equals damage dealt to this construct */
    damageDealt: number;
    /** Total XP token balance held by player */
    xpTotal: number;
    /** Whether the player is currently debuffed on this construct */
    isDebuffed: boolean;
    /** Current debuff stack count on this construct (capped by maxStack) */
    debuffStacks: number;
    /** Effective damage reduction percentage (stacks × damageReduction, capped) */
    debuffReductionPercent: number;
    /** Blocks remaining until the player can attack again (from contract) */
    blocksLeftUntilNextAttack: number;
    /** Whether the player can attack right now (from contract) */
    canAttack: boolean;
}

interface UsePlayerConstructStatsArgs {
    contractId: string | null;
    userAccountId: string | null;
    hpTokenId: string | null;
    xpTokenId: string | null;
    debuffDamageReduction: number;
    debuffMaxStack: number;
}

export const usePlayerConstructStats = ({
    contractId,
    userAccountId,
    hpTokenId,
    xpTokenId,
    debuffDamageReduction,
    debuffMaxStack,
}: UsePlayerConstructStatsArgs): {stats: PlayerConstructStats | null; loading: boolean} => {
    const ledger = useSignumLedger();

    const {data: stats = null, isLoading: loading} = useQuery({
        queryKey: [
            'playerConstructStats',
            contractId,
            userAccountId,
            hpTokenId,
            xpTokenId,
            debuffDamageReduction,
            debuffMaxStack,
        ],
        queryFn: async (): Promise<PlayerConstructStats | null> => {
            if (!ledger || !contractId || !userAccountId) return null;

            const [account, playerStatus, debuffMapValue] = await Promise.all([
                ledger.account.getAccount({accountId: userAccountId}),
                (async () => {
                    try {
                        const player = new ReadOnlyPlayer({ledger, accountId: userAccountId});
                        return await player.constructService.with(contractId).getPlayerStatus(userAccountId);
                    } catch {
                        return null;
                    }
                })(),
                (async () => {
                    try {
                        return await ledger.contract.getSingleContractMapValue({
                            contractId,
                            key1: ContractMaps.AttackersDebuff.toString(),
                            key2: userAccountId,
                        });
                    } catch {
                        return null;
                    }
                })(),
            ]);

            let damageDealt = 0;
            let xpTotal = 0;
            if (account.assetBalances) {
                for (const assetBalance of account.assetBalances) {
                    if (hpTokenId && assetBalance.asset === hpTokenId) {
                        damageDealt = parseInt(assetBalance.balanceQNT || '0');
                    } else if (xpTokenId && assetBalance.asset === xpTokenId) {
                        xpTotal = parseInt(assetBalance.balanceQNT || '0');
                    }
                }
            }

            const rawStacks = debuffMapValue?.value ? parseInt(debuffMapValue.value) : 0;
            const cappedStacks =
                debuffMaxStack > 0 && rawStacks > debuffMaxStack ? debuffMaxStack : rawStacks;
            const debuffReductionPercent = Math.max(0, cappedStacks * debuffDamageReduction);
            const isDebuffed = (playerStatus?.isPlayerDebuffed ?? false) || cappedStacks > 0;

            return {
                damageDealt,
                xpTotal,
                isDebuffed,
                debuffStacks: cappedStacks,
                debuffReductionPercent,
                blocksLeftUntilNextAttack: playerStatus?.blocksLeftUntilNextAttack ?? 0,
                canAttack: playerStatus?.canPlayerAttack ?? true,
            };
        },
        enabled: !!ledger && !!contractId && !!userAccountId,
        staleTime: 15 * 1000,
        refetchInterval: POLLING_INTERVALS.userCooldown,
        refetchOnWindowFocus: false,
        placeholderData: (prev: any) => prev,
    });

    return {stats, loading};
};
