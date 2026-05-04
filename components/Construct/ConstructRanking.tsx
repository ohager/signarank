import React from 'react';
import {useConstructRanking} from '@hooks/useConstructRanking';

interface ConstructRankingProps {
    contractId: string;
    hpTokenId: string;
    maxHp: number;
    userAccountId?: string | null;
}

const monoStyle = {fontFamily: "'IBM Plex Mono', monospace"} as const;

const RANK_COLORS: Record<number, string> = {
    1: 'var(--gold)',
    2: '#94a3b8',
    3: '#b87333',
};

export const ConstructRanking: React.FC<ConstructRankingProps> = ({
    contractId,
    hpTokenId,
    maxHp,
    userAccountId,
}) => {
    const {ranking, loading} = useConstructRanking(hpTokenId, maxHp, contractId);

    return (
        <div className="glass-static overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center gap-2.5">
                <span className="text-[var(--gold)]">⚔</span>
                <span
                    className="text-[0.7rem] text-[var(--text)] uppercase tracking-[0.15em]"
                    style={{fontFamily: "'Cinzel', serif", fontWeight: 600}}
                >
                    Damage Ranking
                </span>
            </div>

            <div className="p-5 max-md:p-4">
                {loading && (
                    <div
                        className="text-[var(--text-faint)] text-center py-8 text-[0.85rem]"
                        style={{fontFamily: "'Cormorant Garamond', serif"}}
                    >
                        Loading ranking...
                    </div>
                )}

                {!loading && ranking.length === 0 && (
                    <div
                        className="text-[var(--text-faint)] text-center py-8 text-[0.9rem]"
                        style={{fontFamily: "'Cormorant Garamond', serif"}}
                    >
                        No attackers yet.
                    </div>
                )}

                {!loading && ranking.length > 0 && (
                    <div className="flex flex-col gap-2">
                        {ranking.map(entry => {
                            const isCurrentUser = userAccountId && entry.account === userAccountId;
                            const rankColor = RANK_COLORS[entry.rank] ?? 'var(--text-dim)';
                            return (
                                <div
                                    key={entry.account}
                                    className="grid gap-3 items-center py-2.5 px-3 rounded-sm"
                                    style={{
                                        gridTemplateColumns: '2rem 1fr auto',
                                        background: isCurrentUser
                                            ? 'rgba(212,175,55,0.06)'
                                            : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${isCurrentUser ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.04)'}`,
                                    }}
                                >
                                    <span
                                        className="text-[0.75rem] font-bold text-center"
                                        style={{...monoStyle, color: rankColor}}
                                    >
                                        #{entry.rank}
                                    </span>
                                    <span
                                        className="text-[0.75rem] truncate"
                                        style={{...monoStyle, color: isCurrentUser ? 'var(--gold)' : 'var(--text)'}}
                                    >
                                        {entry.name ? (
                                            <span style={{color: 'var(--gold)'}}>[{entry.name}] </span>
                                        ) : null}
                                        {entry.accountRS}
                                    </span>
                                    <span className="flex flex-col items-end gap-0.5">
                                        <span
                                            className="text-[0.8rem] font-bold"
                                            style={{...monoStyle, color: 'var(--ember)'}}
                                        >
                                            {entry.damageDealt.toLocaleString()}
                                        </span>
                                        <span
                                            className="text-[0.6rem]"
                                            style={{...monoStyle, color: 'var(--text-faint)'}}
                                        >
                                            {entry.sharePercent.toFixed(2)}%
                                        </span>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConstructRanking;
