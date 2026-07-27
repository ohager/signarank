import React from 'react';
import type { CreationStep } from '@hooks/useCharacterCreation';

interface CreatingStepProps {
    creationStep: CreationStep;
    needsFundingAction: boolean;
    funding: boolean;
    onFund: () => void;
    error?: string;
}

const STEP_LABEL: Record<CreationStep, string> = {
    idle: 'Preparing...',
    'awaiting-deploy-signature': 'Step 1 of 2: Approve character deployment in your wallet',
    'awaiting-funding-signature': 'Step 2 of 2: Approve funding transaction in your wallet',
};

export const CreatingStep: React.FC<CreatingStepProps> = ({ creationStep, needsFundingAction, funding, onFund, error }) => {
    return (
        <div className="glass-static overflow-hidden p-5 text-center">
            {error ? (
                <p className="text-[0.85rem]" style={{ color: '#ef4444' }}>{error}</p>
            ) : needsFundingAction ? (
                <>
                    <p className="text-[0.85rem] text-[var(--text)] mb-4">
                        Character deployed. Now fund it to bring it to life.
                    </p>
                    <button
                        className="py-3 px-6 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:opacity-40"
                        style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                        disabled={funding}
                        onClick={onFund}
                    >
                        {funding ? 'Confirm in wallet...' : 'Continue: Fund Character'}
                    </button>
                </>
            ) : (
                <p className="text-[0.85rem] text-[var(--text)]">{STEP_LABEL[creationStep]}</p>
            )}
        </div>
    );
};

export default CreatingStep;
