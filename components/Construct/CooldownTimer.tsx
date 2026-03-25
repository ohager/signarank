import React from 'react';
import { BLOCK_TIME_MS } from '@lib/construct/constants';

interface CooldownTimerProps {
    blocksRemaining: number;
}

export const CooldownTimer: React.FC<CooldownTimerProps> = ({ blocksRemaining }) => {
    // Estimate time remaining (approximately 4 minutes per block)
    const msRemaining = blocksRemaining * BLOCK_TIME_MS;
    const minutesRemaining = Math.ceil(msRemaining / 60000);

    return (
        <div className="flex items-center gap-2 py-2 px-3 bg-amber-400/10 rounded-lg text-amber-400 mb-3 text-[0.85rem] max-md:py-1.5 max-md:px-2.5 max-md:text-[0.8rem]">
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>
                Cooldown: {blocksRemaining} blocks remaining (~{minutesRemaining} min)
            </span>
        </div>
    );
};

export default CooldownTimer;
