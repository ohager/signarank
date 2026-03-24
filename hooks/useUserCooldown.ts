import { useQuery } from '@tanstack/react-query';
import { UserCooldownStatus } from '@lib/construct/types';
import { ContractMaps, POLLING_INTERVALS, BLOCK_TIME_MS } from '@lib/construct/constants';
import { useSignumLedger } from './useSignumLedger';

export const useUserCooldown = (
    contractId: string | null,
    userAccountId: string | null,
    cooldownBlocks: number
): UserCooldownStatus | null => {
    const ledger = useSignumLedger();

    const { data: status = null } = useQuery({
        queryKey: ['userCooldown', contractId, userAccountId, cooldownBlocks],
        queryFn: async () => {
            if (!ledger || !contractId || !userAccountId || cooldownBlocks <= 0) {
                return null;
            }

            try {
                const blockchainStatus = await ledger.network.getBlockchainStatus();
                const currentBlock = blockchainStatus.numberOfBlocks;

                let lastAttackBlock = 0;
                try {
                    const mapValue = await ledger.contract.getSingleContractMapValue({
                        contractId,
                        key1: userAccountId,
                        key2: ContractMaps.AttackersLastAttack.toString(),
                    });

                    if (mapValue && mapValue.value) {
                        lastAttackBlock = parseInt(mapValue.value);
                    }
                } catch {
                    lastAttackBlock = 0;
                }

                const blocksSinceLastAttack = currentBlock - lastAttackBlock;
                const blocksRemaining = Math.max(0, cooldownBlocks - blocksSinceLastAttack);
                const isInCooldown = blocksRemaining > 0;

                const cooldownEndsAt = isInCooldown
                    ? new Date(Date.now() + blocksRemaining * BLOCK_TIME_MS)
                    : null;

                return {
                    isInCooldown,
                    lastAttackBlock,
                    currentBlock,
                    blocksRemaining,
                    cooldownEndsAt,
                };
            } catch (e) {
                console.error('Failed to check cooldown:', e);
                return {
                    isInCooldown: false,
                    lastAttackBlock: 0,
                    currentBlock: 0,
                    blocksRemaining: 0,
                    cooldownEndsAt: null,
                };
            }
        },
        enabled: !!ledger && !!contractId && !!userAccountId && cooldownBlocks > 0,
        staleTime: 15 * 1000,
        refetchInterval: POLLING_INTERVALS.userCooldown,
        refetchOnWindowFocus: false,
        placeholderData: (prev: any) => prev,
    });

    return status;
};
