import React, { useEffect } from 'react';
import { useCharacterCreationProgress } from '@hooks/useCharacterCreationProgress';
import { updatePendingCharacter, type PendingCharacterState } from '@lib/character/pendingCharacters';

interface ConfirmingStepProps {
    walletAccount: string;
    contractId: string;
    tx1Id: string;
    tx2Id: string;
    onLive: () => void;
}

const STATE_COPY: Record<PendingCharacterState, string> = {
    pending: 'Broadcasting both transactions...',
    deployed: 'Contract deployed on-chain. Waiting for funding to settle...',
    funding_settled: 'Funded. Waiting for the character to wake up...',
    live: 'Your character is alive!',
    needs_funding: 'Waiting for funding...',
    failed: 'Something went wrong.',
};

const WORST_CASE_MS = 8 * 60 * 1000;

export const ConfirmingStep: React.FC<ConfirmingStepProps> = ({ walletAccount, contractId, tx1Id, tx2Id, onLive }) => {
    const { state, elapsedMs } = useCharacterCreationProgress(tx1Id, tx2Id);

    useEffect(() => {
        updatePendingCharacter(walletAccount, contractId, { state });
    }, [walletAccount, contractId, state]);

    useEffect(() => {
        if (state === 'live') onLive();
    }, [state, onLive]);

    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    const elapsedSeconds = Math.floor((elapsedMs % 60000) / 1000);

    return (
        <div className="glass-static overflow-hidden p-5 text-center">
            <p className="text-[0.9rem] text-[var(--text)] mb-2">{STATE_COPY[state]}</p>
            <p className="text-[0.7rem] text-[var(--text-faint)]">
                {elapsedMinutes}m {elapsedSeconds}s elapsed (typically ~4-8 min)
            </p>
            {elapsedMs > WORST_CASE_MS && (
                <p className="text-[0.7rem] mt-2" style={{ color: 'var(--ember)' }}>
                    This is taking longer than usual — the network may be congested. Your character is safe;
                    check back on its dashboard once you have the link.
                </p>
            )}
        </div>
    );
};

export default ConfirmingStep;
