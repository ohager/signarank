import React, {useMemo} from 'react';
import styles from '../styles/Snowfall.module.scss';

interface FallingIconsProps {
    emojis: string[]
}

const FallingIcons = React.memo(({emojis}: FallingIconsProps) => {
    const snowflakes = useMemo(() =>
        Array.from({length: 50}, () => ({
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 10}s`,
            animationDuration: `${10 + Math.random() * 20}s`,
            opacity: 0.3 + Math.random() * 0.7,
            fontSize: `${10 + Math.random() * 20}px`,
            rotation: `${Math.random() * 360}deg`,
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
        })), [emojis]);

    return (
        <div className={styles.snowfall}>
            {snowflakes.map((flake, index) => (
                <div
                    key={index}
                    className={styles.snowflake}
                    style={{
                        left: flake.left,
                        animationDelay: flake.animationDelay,
                        animationDuration: flake.animationDuration,
                        opacity: flake.opacity,
                        fontSize: flake.fontSize,
                        '--rotation': flake.rotation,
                    } as React.CSSProperties}
                >
                    {flake.emoji}
                </div>
            ))}
        </div>
    );
});

FallingIcons.displayName = 'FallingIcons';

export default FallingIcons;
