// hooks/usePendingCharacters.ts
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    getPendingCharacters,
    upsertPendingCharacter,
    updatePendingCharacter,
    type PendingCharacter,
} from '@lib/character/pendingCharacters';

const pendingCharactersQueryKey = (accountId: string | null) => ['pendingCharacters', accountId] as const;

interface UsePendingCharactersResult {
    characters: PendingCharacter[];
    upsert: (character: PendingCharacter) => void;
    update: (contractId: string, patch: Partial<PendingCharacter>) => void;
}

/**
 * Thin react-query wrapper over the pendingCharacters localStorage module.
 * Every component that calls this with the same accountId shares one cache
 * entry, so a write from one component (e.g. the create form) is immediately
 * visible to every other mounted consumer (e.g. the header badge) via
 * invalidation — no separate event bus or Context provider needed.
 */
export const usePendingCharacters = (accountId: string | null): UsePendingCharactersResult => {
    const queryClient = useQueryClient();

    const { data: characters = [] } = useQuery({
        queryKey: pendingCharactersQueryKey(accountId),
        queryFn: () => {
            if (!accountId) return [];
            return getPendingCharacters(accountId);
        },
        enabled: !!accountId,
        staleTime: Infinity, // only ever changes via the explicit writes below
    });

    const upsert = useCallback(
        (character: PendingCharacter) => {
            if (!accountId) return;
            upsertPendingCharacter(accountId, character);
            queryClient.invalidateQueries({ queryKey: pendingCharactersQueryKey(accountId) });
        },
        [accountId, queryClient],
    );

    const update = useCallback(
        (contractId: string, patch: Partial<PendingCharacter>) => {
            if (!accountId) return;
            updatePendingCharacter(accountId, contractId, patch);
            queryClient.invalidateQueries({ queryKey: pendingCharactersQueryKey(accountId) });
        },
        [accountId, queryClient],
    );

    return { characters, upsert, update };
};
