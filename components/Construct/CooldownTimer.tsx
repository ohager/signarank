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
        <div
            className="flex items-center gap-2.5 py-2.5 px-3 bg-[rgba(251,191,36,0.06)] border border-[rgba(251,191,36,0.15)] rounded-sm mb-4"
            style={{ backdropFilter: 'blur(8px)' }}
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0 opacity-80"
            >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
            <span
                className="text-[#fbbf24] text-[0.8rem]"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
                Cooldown: {blocksRemaining} blocks remaining (~{minutesRemaining} min)
            </span>
        </div>
    );
};

export default CooldownTimer;
