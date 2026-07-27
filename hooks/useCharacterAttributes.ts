// hooks/useCharacterAttributes.ts
import { useQuery } from '@tanstack/react-query';
import { ReadOnlyPlayer, type Attributes } from '@signarank/client';
import { useSignumLedger } from '@hooks/useSignumLedger';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';

interface UseCharacterAttributesResult {
    attributes: Attributes | null;
}

/**
 * Reveals a character's 5 rolled attributes once it's live. Mirrors the
 * ReadOnlyPlayer/.character() read pattern useConstruct.ts already uses for
 * constructs. Only ever enabled once `state === 'live'` — before that, the
 * contract hasn't run init() yet and getAttributes() would read nothing.
 */
export const useCharacterAttributes = (
    contractId: string | null,
    state: PendingCharacterState,
): UseCharacterAttributesResult => {
    const ledger = useSignumLedger();

    const { data: attributes } = useQuery({
        queryKey: ['characterAttributes', contractId],
        queryFn: async () => {
            if (!ledger || !contractId) return null;
            const player = new ReadOnlyPlayer({ ledger, accountId: '' });
            return player.character(contractId).getAttributes();
        },
        enabled: !!ledger && !!contractId && state === 'live',
        staleTime: Infinity, // attributes never change after being rolled once
    });

    return { attributes: attributes ?? null };
};
