import React from 'react';
import { BLOCK_TIME_MS } from '@lib/construct/constants';
import styles from '@styles/Construct.module.scss';

interface CooldownTimerProps {
    blocksRemaining: number;
}

export const CooldownTimer: React.FC<CooldownTimerProps> = ({ blocksRemaining }) => {
    // Estimate time remaining (approximately 4 minutes per block)
    const msRemaining = blocksRemaining * BLOCK_TIME_MS;
    const minutesRemaining = Math.ceil(msRemaining / 60000);

    return (
        <div className={styles.cooldownInfo}>
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
