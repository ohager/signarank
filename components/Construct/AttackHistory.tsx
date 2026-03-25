import React from 'react';
import { useAttackHistory } from '@hooks/useAttackHistory';
import { Address } from '@signumjs/core';
import { ChainTime } from '@signumjs/util';
import { getExplorerBaseUrl } from '@lib/explorerUrl';

interface AttackHistoryProps {
    contractId: string;
    xpTokenId: string;
}

export const AttackHistory: React.FC<AttackHistoryProps> = ({ contractId, xpTokenId }) => {
    const { attacks, loading, error } = useAttackHistory(contractId, xpTokenId);

    const formatTimeAgo = (txTimestamp: number): string => {
        const timestamp = ChainTime.fromChainTimestamp(txTimestamp).getEpoch();
        const seconds = Math.floor(Date.now() - timestamp) / 1000;
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    return (
        <div className="glass-static overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center gap-2.5">
                <span className="text-[var(--gold)]">📜</span>
                <span
                    className="text-[0.7rem] text-[var(--text)] uppercase tracking-[0.15em]"
                    style={{ fontFamily: "'Cinzel', serif", fontWeight: 600 }}
                >
                    Battle Log
                </span>
            </div>

            <div className="p-5 max-md:p-4">
                {loading && (
                    <div
                        className="text-[var(--text-faint)] text-center py-8 text-[0.85rem]"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                        Loading attack history...
                    </div>
                )}

                {error && (
                    <div
                        className="text-[#ef4444] text-center py-8 text-[0.8rem]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                        Error: {error}
                    </div>
                )}

                {!loading && !error && attacks.length === 0 && (
                    <div
                        className="text-[var(--text-faint)] text-center py-8 text-[0.9rem]"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                        No attacks yet. Be the first!
                    </div>
                )}

                {!loading && !error && attacks.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {attacks.map((attack, index) => (
                            <div
                                key={attack.txId || index}
                                className="grid grid-cols-[1fr_auto] gap-3 items-center py-2.5 px-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-sm max-md:grid-cols-1 max-md:gap-1 max-md:py-2 max-md:px-2.5"
                            >
                                <div className="flex flex-col gap-1 min-w-0">
                                    <span
                                        className="text-[var(--text)] text-[0.75rem] truncate"
                                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                    >
                                        {attack.attackerName ? (
                                            <span className="text-[var(--gold)]">[{attack.attackerName}]</span>
                                        ) : null}
                                        {' '}{attack.attacker}
                                        <span className="text-[var(--text-dim)] ml-1">
                                            ({attack.attackerXp} XP)
                                        </span>
                                    </span>
                                    <span className="flex items-center gap-2">
                                        <span
                                            className="text-[var(--text-faint)] text-[0.65rem]"
                                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                        >
                                            {formatTimeAgo(attack.timestamp)}
                                        </span>
                                        {attack.blockHeight > 0 && (
                                            <span
                                                className="text-[var(--text-faint)] text-[0.6rem]"
                                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                            >
                                                Block {attack.blockHeight.toLocaleString()}
                                            </span>
                                        )}
                                        {attack.txId && (
                                            <a
                                                className="text-[var(--frost)] text-[0.6rem] no-underline opacity-60 hover:opacity-100 hover:underline"
                                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                                href={`${getExplorerBaseUrl()}/tx/${attack.txId}`}
                                                target="_blank"
                                                rel="noreferrer noopener"
                                                title="View in Explorer"
                                            >
                                                Tx
                                            </a>
                                        )}
                                    </span>
                                </div>
                                <span
                                    className="text-[var(--ember)] font-bold text-[0.85rem] max-md:text-[0.8rem]"
                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                >
                                    -{attack.damage.toLocaleString()} HP
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AttackHistory;
