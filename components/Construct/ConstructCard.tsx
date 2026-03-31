import React from 'react';
import { ConstructData } from '@lib/construct/types';
import { useAttackerData } from '@hooks/useAttackerData';

interface ConstructCardProps {
    construct: ConstructData;
}

export const ConstructCard: React.FC<ConstructCardProps> = ({ construct }) => {
    const finalBlowAttacker = useAttackerData(construct.finalBlowAccount);
    const firstBloodAttacker = useAttackerData(construct.firstBloodAccount);
    const hpPercent = construct.currentHp / construct.maxHp;
    const hpColor = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.25 ? '#fbbf24' : '#ef4444';

    return (
        <div className="glass-static overflow-hidden">
            {/* Image */}
            <div className="relative w-full aspect-[2.5/1] overflow-hidden max-md:aspect-[2/1]">
                <img
                    src={construct.imageUrl}
                    alt={construct.name}
                    className="w-full h-full object-cover object-top"
                />
                {construct.isDefeated && (
                    <div className="absolute inset-0 bg-black/70 flex justify-center items-center">
                        <span
                            className="text-3xl font-bold uppercase tracking-[0.3rem]"
                            style={{
                                fontFamily: "'Cinzel', serif",
                                color: '#ef4444',
                                textShadow: '0 0 20px rgba(239,68,68,0.5)',
                            }}
                        >
                            DEFEATED
                        </span>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="py-4 px-5 max-md:py-3 max-md:px-4">
                <h2
                    className="text-xl text-[var(--text)] m-0 mb-1 max-md:text-lg"
                    style={{ fontFamily: "'Cinzel', serif", fontWeight: 600 }}
                >
                    {construct.name}
                </h2>
                <p
                    className="text-[var(--text-dim)] m-0 mb-4 text-[0.85rem] leading-relaxed max-md:text-xs"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                    {construct.description}
                </p>

                <div className="flex flex-col gap-3">
                    {/* HP Bar */}
                    <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                            <span
                                className="text-[0.65rem] text-[var(--text-faint)] uppercase tracking-[0.12em]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                HP
                            </span>
                            <span
                                className="text-[0.75rem] text-[var(--text-dim)]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                {construct.currentHp.toLocaleString()} / {construct.maxHp.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-3 bg-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden max-md:h-2.5">
                            <div
                                className="h-full rounded-sm transition-all duration-300"
                                style={{
                                    width: `${hpPercent * 100}%`,
                                    backgroundColor: hpColor,
                                    boxShadow: `0 0 8px ${hpColor}44`,
                                }}
                            />
                        </div>
                    </div>

                    {/* Stats Row */}
                    <div className="flex gap-6 flex-wrap max-md:gap-4">
                        <div className="flex flex-col gap-0.5">
                            <span
                                className="text-[0.6rem] text-[var(--text-faint)] uppercase tracking-[0.12em]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                Cooldown
                            </span>
                            <span
                                className="text-[0.8rem] text-[var(--text)] max-md:text-[0.75rem]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                {construct.coolDownInBlocks} blocks
                            </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span
                                className="text-[0.6rem] text-[var(--text-faint)] uppercase tracking-[0.12em]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                Breach Limit
                            </span>
                            <span
                                className="text-[0.8rem] text-[var(--text)] max-md:text-[0.75rem]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                {construct.breachLimit}%
                            </span>
                        </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex gap-2 mt-1">
                        {construct.isActive ? (
                            <span
                                className="py-1 px-3 rounded-sm text-[0.65rem] font-semibold uppercase tracking-[0.1em] bg-[rgba(74,222,128,0.1)] text-[#4ade80] border border-[rgba(74,222,128,0.2)]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                Active
                            </span>
                        ) : (
                            <span
                                className="py-1 px-3 rounded-sm text-[0.65rem] font-semibold uppercase tracking-[0.1em] bg-[rgba(156,163,175,0.1)] text-[var(--text-faint)] border border-[rgba(156,163,175,0.15)]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                Inactive
                            </span>
                        )}
                        {construct.isDefeated && (
                            <span
                                className="py-1 px-3 rounded-sm text-[0.65rem] font-semibold uppercase tracking-[0.1em] bg-[rgba(239,68,68,0.1)] text-[#ef4444] border border-[rgba(239,68,68,0.2)]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                Defeated
                            </span>
                        )}
                    </div>
                </div>

                {/* Defeated Info */}
                {construct.isDefeated && finalBlowAttacker && (
                    <div className="mt-4 pt-4 border-t border-[var(--glass-border)]">
                        <div className="flex flex-col gap-1.5">
                            <p
                                className="m-0 text-[0.8rem] text-[var(--text-dim)]"
                                style={{ fontFamily: "'Cormorant Garamond', serif" }}
                            >
                                <span className="text-[var(--gold)]">Final Blow:</span>{' '}
                                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>
                                    {finalBlowAttacker.attacker ? `[${finalBlowAttacker.attackerName}] ` : ''}
                                    {finalBlowAttacker.attacker} ({finalBlowAttacker.attackerXp} XP)
                                </span>
                            </p>
                            {firstBloodAttacker && (
                                <p
                                    className="m-0 text-[0.8rem] text-[var(--text-dim)]"
                                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                                >
                                    <span className="text-[var(--ember)]">First Blood:</span>{' '}
                                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.75rem' }}>
                                        {firstBloodAttacker.attacker ? `[${firstBloodAttacker.attackerName}] ` : ''}
                                        {firstBloodAttacker.attacker} ({firstBloodAttacker.attackerXp} XP)
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConstructCard;
