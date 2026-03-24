import React, {useCallback, useMemo} from 'react';
import {useAttackHistory} from '@hooks/useAttackHistory';
import styles from '@styles/Construct.module.scss';
import {Address} from "@signumjs/core";
import {ChainTime} from "@signumjs/util";

interface AttackHistoryProps {
    contractId: string;
    xpTokenId: string;
}

export const AttackHistory: React.FC<AttackHistoryProps> = ({contractId, xpTokenId}) => {
    const {attacks, loading, error} = useAttackHistory(contractId, xpTokenId);

    const formatTimeAgo = (txTimestamp: number): string => {
        const timestamp = ChainTime.fromChainTimestamp(txTimestamp).getEpoch();
        const seconds = Math.floor(Date.now()  - timestamp) / 1000;
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    return (
        <div className={styles.historyCard}>
            <h3 className={styles.historyTitle}>Recent Attacks</h3>

            {loading && (
                <div className={styles.noAttacks}>Loading attack history...</div>
            )}

            {error && (
                <div className={styles.noAttacks} style={{color: '#ef4444'}}>
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
                                    {attack.attackerName ? `[${attack.attackerName}] ` : ''}
                                    {attack.attacker} ({attack.attackerXp} XP)
                                </span>
                                <span className={styles.attackMeta}>
                                    <span className={styles.attackTime}>
                                        {formatTimeAgo(attack.timestamp)}
                                    </span>
                                    {attack.blockHeight > 0 && (
                                        <span className={styles.attackBlock}>
                                            Block {attack.blockHeight.toLocaleString()}
                                        </span>
                                    )}
                                    {attack.txId && (
                                        <a
                                            className={styles.explorerLink}
                                            href={`${process.env.NEXT_PUBLIC_SIGNUM_EXPLORER}/tx/${attack.txId}`}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            title="View in Explorer"
                                        >
                                            Tx
                                        </a>
                                    )}
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
