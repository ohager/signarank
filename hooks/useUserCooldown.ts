import { useQuery } from 'react-query';
import { UserCooldownStatus } from '@lib/construct/types';
import { ContractMaps, POLLING_INTERVALS, BLOCK_TIME_MS } from '@lib/construct/constants';
import { useSignumLedger } from './useSignumLedger';

export const useUserCooldown = (
    contractId: string | null,
    userAccountId: string | null,
    cooldownBlocks: number
): UserCooldownStatus | null => {
    const ledger = useSignumLedger();

    const { data: status = null } = useQuery(
        ['userCooldown', contractId, userAccountId, cooldownBlocks],
        async () => {
            if (!ledger || !contractId || !userAccountId || cooldownBlocks <= 0) {
                return null;
            }

            try {
                // Get current block height
                const blockchainStatus = await ledger.network.getBlockchainStatus();
                const currentBlock = blockchainStatus.numberOfBlocks;

                // Try to get last attack block from contract map
                let lastAttackBlock = 0;
                try {
                    // TODO: Replace with helper library when provided
                    // For now, use contract.getContractMapValuesByFirstKey
                    const mapValue = await ledger.contract.getSingleContractMapValue({
                        contractId,
                        key1: userAccountId,
                        key2: ContractMaps.AttackersLastAttack.toString(),
                    });

                    if (mapValue && mapValue.value) {
                        lastAttackBlock = parseInt(mapValue.value);
                    }
                } catch {
                    // Map key not found = user never attacked = no cooldown
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
                // On error, assume no cooldown to not block the user
                return {
                    isInCooldown: false,
                    lastAttackBlock: 0,
                    currentBlock: 0,
                    blocksRemaining: 0,
                    cooldownEndsAt: null,
                };
            }
        },
        {
            enabled: !!ledger && !!contractId && !!userAccountId && cooldownBlocks > 0,
            staleTime: 15 * 1000, // Consider data fresh for 15 seconds
            refetchInterval: POLLING_INTERVALS.userCooldown, // Refetch every 30 seconds
            refetchOnWindowFocus: false,
            keepPreviousData: true,
        }
    );

    return status;
};
