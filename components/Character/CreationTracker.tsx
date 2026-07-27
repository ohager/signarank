// components/Character/CreationTracker.tsx
import React, { useEffect } from 'react';
import { useCharacterCreationProgress } from '@hooks/useCharacterCreationProgress';
import { usePendingCharacters } from '@hooks/usePendingCharacters';
import type { PendingCharacter } from '@lib/character/pendingCharacters';

interface CreationTrackerProps {
    accountId: string;
    character: PendingCharacter;
}

/**
 * Renders nothing. Exists purely to keep a pending character's on-chain
 * progress query alive (and its localStorage state in sync) for as long as
 * the app is mounted, regardless of which page is visible — mounted once per
 * in-flight character by Header.tsx (and, redundantly-but-harmlessly, by
 * /character/[contractId] while that page is open, since react-query
 * dedupes identical queryKeys into one shared poll).
 */
export const CreationTracker: React.FC<CreationTrackerProps> = ({ accountId, character }) => {
    const { update } = usePendingCharacters(accountId);
    const { state } = useCharacterCreationProgress(character.tx1Id, character.tx2Id ?? null);
    const canPoll = !!character.tx1Id && !!character.tx2Id;

    useEffect(() => {
        // Guard on canPoll: when polling is disabled (e.g. tx2 doesn't exist
        // yet, a needs_funding character), the underlying query has no data
        // and `state` falls back to 'pending' — writing that back would
        // incorrectly stomp a real 'needs_funding'/'failed' entry.
        if (!canPoll || state === character.state) return;
        update(character.contractId, { state });
    }, [canPoll, state, character.contractId, character.state, update]);

    return null;
};

export default CreationTracker;
