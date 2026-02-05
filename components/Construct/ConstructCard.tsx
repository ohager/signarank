import React from 'react';
import { ConstructData } from '@lib/construct/types';
import styles from '@styles/Construct.module.scss';

interface ConstructCardProps {
    construct: ConstructData;
}

export const ConstructCard: React.FC<ConstructCardProps> = ({ construct }) => {
    const hpPercent = construct.currentHp / construct.maxHp;
    const hpColor = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.25 ? '#fbbf24' : '#ef4444';

    return (
        <div className={styles.constructCard}>
            <div className={styles.imageContainer}>
                <img
                    src={construct.imageUrl}
                    alt={construct.name}
                    className={styles.constructImage}
                />
                {construct.isDefeated && (
                    <div className={styles.defeatedOverlay}>
                        <span className={styles.defeatedBadge}>DEFEATED</span>
                    </div>
                )}
            </div>

            <div className={styles.constructInfo}>
                <h2 className={styles.constructName}>{construct.name}</h2>
                <p className={styles.constructDescription}>{construct.description}</p>

                <div className={styles.stats}>
                    <div className={styles.hpSection}>
                        <div className={styles.hpLabel}>
                            <span>HP</span>
                            <span>{construct.currentHp.toLocaleString()} / {construct.maxHp.toLocaleString()}</span>
                        </div>
                        <div className={styles.hpBarOuter}>
                            <div
                                className={styles.hpBarInner}
                                style={{
                                    width: `${hpPercent * 100}%`,
                                    backgroundColor: hpColor
                                }}
                            />
                        </div>
                    </div>

                    <div className={styles.statRow}>
                        <div className={styles.stat}>
                            <span className={styles.statLabel}>Cooldown</span>
                            <span className={styles.statValue}>{construct.coolDownInBlocks} blocks</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statLabel}>Breach Limit</span>
                            <span className={styles.statValue}>{construct.breachLimit}%</span>
                        </div>
                    </div>

                    <div className={styles.statusBadges}>
                        {construct.isActive ? (
                            <span className={`${styles.badge} ${styles.activeBadge}`}>Active</span>
                        ) : (
                            <span className={`${styles.badge} ${styles.inactiveBadge}`}>Inactive</span>
                        )}
                        {construct.isDefeated && (
                            <span className={`${styles.badge} ${styles.defeatedBadgeSmall}`}>Defeated</span>
                        )}
                    </div>
                </div>

                {construct.isDefeated && construct.finalBlowAccount && (
                    <div className={styles.victoryInfo}>
                        <p>Final Blow: {construct.finalBlowAccount}</p>
                        {construct.firstBloodAccount && (
                            <p>First Blood: {construct.firstBloodAccount}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConstructCard;
