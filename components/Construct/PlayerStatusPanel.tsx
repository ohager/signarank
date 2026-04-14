import React from 'react';
import {ConstructData} from '@lib/construct/types';
import {PlayerConstructStats} from '@hooks/usePlayerConstructStats';

interface PlayerStatusPanelProps {
    construct: ConstructData;
    userAccountId: string;
    stats: PlayerConstructStats | null;
    loading: boolean;
}

const labelCls = "text-[0.6rem] text-[var(--text-faint)] uppercase tracking-[0.12em]";
const valueCls = "text-[0.9rem] text-[var(--text)] max-md:text-[0.8rem]";
const monoStyle = {fontFamily: "'IBM Plex Mono', monospace"} as const;

export const PlayerStatusPanel: React.FC<PlayerStatusPanelProps> = ({
    construct,
    userAccountId,
    stats,
    loading,
}) => {
    const isFirstBlood = construct.firstBloodAccount === userAccountId;
    const isFinalBlow = construct.finalBlowAccount === userAccountId;
    const blocksLeft = stats?.blocksLeftUntilNextAttack ?? 0;
    const inCooldown = stats ? !stats.canAttack && blocksLeft > 0 : false;
    const isDebuffed = stats?.isDebuffed ?? false;
    const debuffStacks = stats?.debuffStacks ?? 0;
    const debuffReductionPercent = stats?.debuffReductionPercent ?? 0;
    const debuffLabel = isDebuffed
        ? debuffReductionPercent > 0
            ? `−${debuffReductionPercent}% (×${debuffStacks})`
            : 'Debuffed'
        : 'Normal';

    return (
        <div className="glass-static py-4 px-5 max-md:py-3 max-md:px-4">
            <div className="flex justify-between items-center gap-3 mb-3">
                <h3
                    className="text-[0.7rem] uppercase tracking-[0.18em] text-[var(--text-dim)] m-0"
                    style={monoStyle}
                >
                    Your Status
                </h3>
                <div className="flex gap-2 items-center flex-wrap justify-end">
                    {isFirstBlood && (
                        <span
                            className="py-1 px-2.5 rounded-sm text-[0.6rem] font-semibold uppercase tracking-[0.1em] border"
                            style={{
                                ...monoStyle,
                                background: 'rgba(232,93,58,0.1)',
                                color: 'var(--ember)',
                                borderColor: 'rgba(232,93,58,0.3)',
                                textShadow: '0 0 8px rgba(232,93,58,0.3)',
                            }}
                        >
                            First Blood
                        </span>
                    )}
                    {isFinalBlow && (
                        <span
                            className="py-1 px-2.5 rounded-sm text-[0.6rem] font-semibold uppercase tracking-[0.1em] border"
                            style={{
                                ...monoStyle,
                                background: 'rgba(212,175,55,0.1)',
                                color: 'var(--gold)',
                                borderColor: 'rgba(212,175,55,0.3)',
                                textShadow: '0 0 8px rgba(212,175,55,0.3)',
                            }}
                        >
                            Final Blow
                        </span>
                    )}
                    {loading && !stats && (
                        <span className="text-[0.65rem] text-[var(--text-faint)]" style={monoStyle}>
                            Loading...
                        </span>
                    )}
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 max-sm:grid-cols-2 max-sm:gap-4">
                <div className="flex flex-col gap-0.5">
                    <span className={labelCls} style={monoStyle}>Damage</span>
                    <span className={valueCls} style={monoStyle}>
                        {stats ? stats.damageDealt.toLocaleString() : '—'}
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className={labelCls} style={monoStyle}>Total XP</span>
                    <span className={valueCls} style={monoStyle}>
                        {stats ? stats.xpTotal.toLocaleString() : '—'}
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className={labelCls} style={monoStyle}>Cooldown</span>
                    <span
                        className={`${valueCls} ${inCooldown ? 'text-[#fbbf24]' : 'text-[#4ade80]'}`}
                        style={monoStyle}
                    >
                        {inCooldown ? `${blocksLeft} blocks` : 'Ready'}
                    </span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className={labelCls} style={monoStyle}>Debuff</span>
                    <span
                        className={`${valueCls} ${isDebuffed ? 'text-[#ef4444]' : 'text-[#4ade80]'}`}
                        style={monoStyle}
                        title={
                            isDebuffed
                                ? `${debuffStacks} stack(s) × ${construct.debuffDamageReduction}% reduction`
                                : 'No active debuff'
                        }
                    >
                        {debuffLabel}
                    </span>
                </div>
            </div>

        </div>
    );
};

export default PlayerStatusPanel;
