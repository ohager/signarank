import React from 'react';
import Page from '@components/Page';
import { useSeasonInfo } from '@hooks/useSeasonInfo';
import { useConstruct } from '@hooks/useConstruct';
import { getCurrentSeasonConstructs } from '@lib/construct/seasonConstructs';
import styles from '@styles/Season.module.scss';
import Link from 'next/link';

const SeasonPage = () => {
    const seasonInfo = useSeasonInfo();
    const constructs = getCurrentSeasonConstructs();

    return (
        <Page title={`${seasonInfo.name} Season - SIGNArank`}>
            <div className={`${styles.seasonPage} content`}>
                <div className={styles.seasonHeader}>
                    <h1>{seasonInfo.name} Season</h1>
                    <p className={styles.seasonDesc}>{seasonInfo.description}</p>
                </div>

                <div className={styles.constructGrid}>
                    {constructs.map((constructConfig) => (
                        <ConstructSeasonCard
                            key={constructConfig.contractId}
                            contractId={constructConfig.contractId}
                            name={constructConfig.name}
                            order={constructConfig.order}
                        />
                    ))}
                </div>
            </div>
        </Page>
    );
};

interface ConstructSeasonCardProps {
    contractId: string;
    name: string;
    order: number;
}

const ConstructSeasonCard: React.FC<ConstructSeasonCardProps> = ({ contractId, name, order }) => {
    const isLocked = contractId.startsWith('TBD_');
    const { construct, loading } = useConstruct(isLocked ? null : contractId);

    // Locked/upcoming construct
    if (isLocked) {
        return (
            <div className={`${styles.constructCard} ${styles.locked}`}>
                <div className={styles.lockedOverlay}>
                    <div className={styles.lockIcon}>🔒</div>
                    <div className={styles.lockedText}>Coming Soon</div>
                    <div className={styles.constructOrder}>#{order}</div>
                </div>
            </div>
        );
    }

    if (loading || !construct) {
        return (
            <div className={styles.constructCard}>
                <div className={styles.cardLoading}>Loading...</div>
            </div>
        );
    }

    const hpPercent = construct.maxHp > 0 ? construct.currentHp / construct.maxHp : 0;
    const isActive = construct.isActive && !construct.isDefeated;
    const isDefeated = construct.isDefeated;

    return (
        <Link href={`/construct/${construct.contractId}`}>
            <a style={{ textDecoration: 'none' }}>
                <div
                    className={`${styles.constructCard} ${
                        isActive ? styles.active : isDefeated ? styles.defeated : ''
                    }`}
                >
                    <div className={styles.cardImage}>
                        <img src={construct.imageUrl} alt={construct.name} />
                        {isActive && <div className={styles.activeBadge}>⚡ ACTIVE</div>}
                        {isDefeated && <div className={styles.defeatedBadge}>💀 DEFEATED</div>}
                    </div>
                    <div className={styles.cardContent}>
                        <h3 className={styles.cardTitle}>{construct.name}</h3>
                        <div className={styles.hpInfo}>
                            <div className={styles.hpLabel}>
                                <span>HP</span>
                                <span>
                                    {construct.currentHp.toLocaleString()} / {construct.maxHp.toLocaleString()}
                                </span>
                            </div>
                            <div className={styles.hpBar}>
                                <div
                                    className={styles.hpFill}
                                    style={{
                                        width: `${hpPercent * 100}%`,
                                        backgroundColor:
                                            hpPercent > 0.5
                                                ? '#4ade80'
                                                : hpPercent > 0.25
                                                ? '#fbbf24'
                                                : '#ef4444',
                                    }}
                                />
                            </div>
                        </div>
                        {isActive && <div className={styles.cardCta}>Attack Now →</div>}
                        {isDefeated && construct.finalBlowAccount && (
                            <div className={styles.victorInfo}>
                                Victor: {construct.finalBlowAccount.slice(0, 10)}...
                            </div>
                        )}
                    </div>
                </div>
            </a>
        </Link>
    );
};

export default SeasonPage;
