import { useQuery } from 'react-query';
import { ConstructData, ConstructMeta } from '@lib/construct/types';
import { ConstructCache } from '@lib/construct/cache';
import { R2_CDN_BASE, POLLING_INTERVALS } from '@lib/construct/constants';
import { useSignumLedger } from './useSignumLedger';

// TODO: Replace with real contract reading when helper library is provided
const MOCK_CONSTRUCT: ConstructData = {
    contractId: '12345678901234567890',
    name: 'CT000001',
    description: 'A fearsome construct awaiting challengers.',
    imageUrl: `${R2_CDN_BASE}/bafybeicus73ymjljts2wkkkn4cqzo2khzaplj6zkheei4hka54dgrqz6sm`,
    currentHp: 35000,
    maxHp: 50000,
    coolDownInBlocks: 15,
    baseDamageRatio: 10,
    breachLimit: 20,
    isActive: true,
    isDefeated: false,
    xpTokenId: '1000',
    hpTokenId: '1001',
    rewardNftId: null,
    firstBloodAccount: null,
    finalBlowAccount: null,
};

interface UseConstructResult {
    construct: ConstructData | null;
    loading: boolean;
    error: string | null;
    refetch: () => void;
}

export const useConstruct = (contractId: string | null): UseConstructResult => {
    const ledger = useSignumLedger();

    const { data: construct, isLoading: loading, error: queryError, refetch } = useQuery(
        ['construct', contractId],
        async () => {
            if (!contractId) return null;

            // Check cache first for static metadata
            const cachedMeta = ConstructCache.getConstructMeta(contractId);
            const cachedDefeated = ConstructCache.getDefeatedStatus(contractId);

            // TODO: When helper library is provided, replace this with real contract reads
            // For now, use mock data
            // const contractData = await helperLibrary.getConstructStatus(ledger, contractId);

            // Simulate API delay
            await new Promise(resolve => setTimeout(resolve, 500));

            // Use mock data for now
            const mockData = {
                ...MOCK_CONSTRUCT,
                contractId,
                // If we have cached metadata, use it
                ...(cachedMeta && {
                    name: cachedMeta.name,
                    description: cachedMeta.description,
                    imageUrl: cachedMeta.imageUrl,
                    maxHp: cachedMeta.maxHp,
                    coolDownInBlocks: cachedMeta.coolDownInBlocks,
                }),
            };

            // If defeated status is cached, use it
            if (cachedDefeated) {
                mockData.isDefeated = true;
                mockData.firstBloodAccount = cachedDefeated.firstBloodAccount;
                mockData.finalBlowAccount = cachedDefeated.finalBlowAccount;
            }

            // Cache static metadata if not already cached
            if (!cachedMeta) {
                ConstructCache.setConstructMeta(contractId, {
                    contractId,
                    name: mockData.name,
                    description: mockData.description,
                    imageUrl: mockData.imageUrl,
                    maxHp: mockData.maxHp,
                    coolDownInBlocks: mockData.coolDownInBlocks,
                });
            }

            // Cache defeated status if construct is defeated
            if (mockData.isDefeated && !cachedDefeated) {
                ConstructCache.setDefeatedStatus(contractId, {
                    contractId,
                    finalBlowAccount: mockData.finalBlowAccount || '',
                    firstBloodAccount: mockData.firstBloodAccount || '',
                    defeatedAt: Date.now(),
                });
            }

            return mockData;
        },
        {
            enabled: !!contractId,
            staleTime: 20 * 1000, // Consider data fresh for 20 seconds
            refetchInterval: POLLING_INTERVALS.currentHp, // Refetch every 30 seconds
            refetchOnWindowFocus: false, // Don't refetch on window focus
            keepPreviousData: true, // Keep previous data while fetching new data (prevents flashing)
        }
    );

    return {
        construct: construct ?? null,
        loading,
        error: queryError ? String(queryError) : null,
        refetch: () => { refetch(); }
    };
};
