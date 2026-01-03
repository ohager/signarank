import React from 'react';
import styles from '../styles/Snowfall.module.scss';

const Snowfall: React.FC = () => {
    // Create multiple snowflakes with different animations
    const snowflakes = Array.from({ length: 50 }, (_, i) => i);

    return (
        <div className={styles.snowfall}>
            {snowflakes.map((_, index) => (
                <div
                    key={index}
                    className={styles.snowflake}
                    style={{
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 10}s`,
                        animationDuration: `${10 + Math.random() * 20}s`,
                        opacity: 0.3 + Math.random() * 0.7,
                        fontSize: `${10 + Math.random() * 20}px`
                    }}
                >
                    ❄
                </div>
            ))}
        </div>
    );
};

export default Snowfall;
