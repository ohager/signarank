import React from 'react';
import { AttackRecord } from '@lib/construct/types';
import { useAttackHistory } from '@hooks/useAttackHistory';
import styles from '@styles/Construct.module.scss';

interface AttackHistoryProps {
    contractId: string;
    xpTokenId: string;
}

export const AttackHistory: React.FC<AttackHistoryProps> = ({ contractId, xpTokenId }) => {
    const { attacks, loading, error } = useAttackHistory(contractId, xpTokenId);

    const formatTimeAgo = (timestamp: number): string => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const truncateAddress = (address: string): string => {
        if (address.length <= 16) return address;
        return `${address.slice(0, 8)}...${address.slice(-6)}`;
    };

    return (
        <div className={styles.historyCard}>
            <h3 className={styles.historyTitle}>Recent Attacks</h3>

            {loading && (
                <div className={styles.noAttacks}>Loading attack history...</div>
            )}

            {error && (
                <div className={styles.noAttacks} style={{ color: '#ef4444' }}>
                    Error: {error}
                </div>
            )}

            {!loading && !error && attacks.length === 0 && (
                <div className={styles.noAttacks}>No attacks yet. Be the first!</div>
            )}

            {!loading && !error && attacks.length > 0 && (
                <div className={styles.attackList}>
                    {attacks.map((attack, index) => (
                        <div key={attack.txId || index} className={styles.attackItem}>
                            <div className={styles.attackerInfo}>
                                <span className={styles.attackerAddress}>
                                    {attack.attackerName || truncateAddress(attack.attacker)}
                                </span>
                                <span className={styles.attackTime}>
                                    {formatTimeAgo(attack.timestamp)}
                                </span>
                            </div>
                            <span className={styles.damageAmount}>
                                -{attack.damage.toLocaleString()} HP
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AttackHistory;
