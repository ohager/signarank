import React, { useEffect, useState } from 'react';
import { ConstructData } from '@lib/construct/types';
import { useAttackerData } from '@hooks/useAttackerData';
import { getExplorerBaseUrl } from '@lib/construct/constants';
import { resolveDamageVariantUrl, resolveDisplayUrl } from '@lib/construct/damageVariants';

interface ConstructCardProps {
    construct: ConstructData;
}

export const ConstructCard: React.FC<ConstructCardProps> = ({ construct }) => {
    const finalBlowAttacker = useAttackerData(construct.finalBlowAccount);
    const firstBloodAttacker = useAttackerData(construct.firstBloodAccount);
    const hpPercent = construct.currentHp / construct.maxHp;
    const hpColor = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.25 ? '#fbbf24' : '#ef4444';
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [displayImageUrl, setDisplayImageUrl] = useState(construct.imageUrl);

    useEffect(() => {
        const variantUrl = resolveDamageVariantUrl(
            construct.ipfsCid,
            construct.isDefeated,
            construct.currentHp,
            construct.maxHp,
        );
        if (!variantUrl) {
            setDisplayImageUrl(construct.imageUrl);
            return;
        }
        let cancelled = false;
        resolveDisplayUrl(variantUrl, construct.imageUrl).then(url => {
            if (!cancelled) setDisplayImageUrl(url);
        });
        return () => { cancelled = true; };
    }, [construct.ipfsCid, construct.isDefeated, construct.currentHp, construct.maxHp, construct.imageUrl]);

    useEffect(() => {
        if (!isLightboxOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsLightboxOpen(false);
        };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [isLightboxOpen]);

    const formattedRewardPot = Number(construct.rewardPot).toLocaleString(undefined, {
        maximumFractionDigits: 2,
    });


    return (
        <div className="glass-static overflow-hidden grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] max-md:grid-cols-1">
            {/* Image (portrait) */}
            <button
                type="button"
                onClick={() => setIsLightboxOpen(true)}
                aria-label={`View full image of ${construct.name}`}
                className="relative w-full h-full min-h-[360px] overflow-hidden max-md:h-[45vh] max-md:min-h-[280px] group cursor-zoom-in p-0 border-0 bg-transparent"
            >
                <img
                    src={displayImageUrl}
                    alt={construct.name}
                    onError={() => setDisplayImageUrl(construct.imageUrl)}
                    className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
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
            </button>

            {/* Content */}
            <div className="py-4 px-5 max-md:py-3 max-md:px-4 flex flex-col">
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

                    {/* Reward Pot */}
                    <div
                        className="flex justify-between items-baseline gap-2 py-2 px-3 rounded-sm border border-[rgba(212,175,55,0.25)] bg-[rgba(212,175,55,0.06)] max-sm:py-1.5 max-sm:px-2.5"
                    >
                        <span
                            className="text-[0.65rem] text-[var(--text-faint)] uppercase tracking-[0.14em] max-sm:text-[0.6rem]"
                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                            Reward Pot
                        </span>
                        <span
                            className="text-[1rem] text-[var(--gold)] max-md:text-[0.9rem] max-sm:text-[0.8rem] truncate"
                            style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                fontWeight: 600,
                                textShadow: '0 0 8px rgba(212,175,55,0.3)',
                            }}
                            title={`${construct.playersRewardPercent}% of contract balance distributed to players`}
                        >
                            {formattedRewardPot} SIGNA
                        </span>
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

                    {/* Trait Badges */}
                    {(() => {
                        const traits: { label: string; href?: string }[] = [];

                        const hp = construct.maxHp;
                        if (hp >= 25000) traits.push({ label: '☽ Primordial' });
                        else if (hp >= 15000) traits.push({ label: '⬡ Archon' });
                        else if (hp >= 10000) traits.push({ label: '◈ Titan' });
                        else if (hp >= 7500) traits.push({ label: '⚑ Warlord' });

                        if (construct.regenHitpoints > 0 && construct.regenBlockInterval > 0)
                            traits.push({ label: '↺ Regenerates' });
                        if (construct.debuffDamageReduction > 0)
                            traits.push({ label: '✦ Curses' });
                        if (construct.rewardNftId && construct.rewardNftId !== '0')
                            traits.push({ label: '◆ Drops NFT', href: `https://www.signumart.io/item/${construct.rewardNftId}` });
                        if (construct.breachLimit >= 20)
                            traits.push({ label: '⬡ Fortified' });

                        if (traits.length === 0) return null;

                        const badgeStyle = {
                            fontFamily: "'IBM Plex Mono', monospace",
                            color: 'var(--gold)',
                            background: 'rgba(197,164,78,0.08)',
                            border: '1px solid rgba(197,164,78,0.2)',
                        };
                        const badgeClass = 'text-[0.6rem] font-semibold uppercase tracking-[0.08em] py-0.5 px-2 rounded-sm';

                        return (
                            <div>
                                <span
                                    className="block text-[0.6rem] text-[var(--text-faint)] uppercase tracking-[0.12em] mb-1.5"
                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                >
                                    Traits
                                </span>
                                <div className="flex gap-1.5 flex-wrap">
                                    {traits.map(t => t.href ? (
                                        <a
                                            key={t.label}
                                            href={t.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`${badgeClass} hover:opacity-80 transition-opacity`}
                                            style={badgeStyle}
                                        >
                                            {t.label} ↗
                                        </a>
                                    ) : (
                                        <span
                                            key={t.label}
                                            className={badgeClass}
                                            style={badgeStyle}
                                        >
                                            {t.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

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

                {/* Explorer link */}
                <a
                    href={`${getExplorerBaseUrl()}/address/${construct.contractId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto pt-3 self-start inline-flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.12em] text-[var(--text-faint)] hover:text-[var(--gold)] transition-colors"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                    View full history on Explorer ↗
                </a>

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
                                        {firstBloodAttacker.attackerName ? `[${firstBloodAttacker.attackerName}] ` : ''}
                                        {firstBloodAttacker.attacker} ({firstBloodAttacker.attackerXp} XP)
                                    </span>
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {isLightboxOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={`${construct.name} full image`}
                    onClick={() => setIsLightboxOpen(false)}
                    className="fixed inset-0 z-[1000] flex justify-center items-center p-6 max-md:p-3 bg-black/85 backdrop-blur-md cursor-zoom-out animate-[fadeIn_0.2s_ease-out]"
                    style={{ animation: 'fadeIn 0.2s ease-out' }}
                >
                    <img
                        src={displayImageUrl}
                        alt={construct.name}
                        onClick={(e) => e.stopPropagation()}
                        className="max-w-[min(90vw,900px)] max-h-[90vh] object-contain rounded-sm shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
                    />
                    <button
                        type="button"
                        onClick={() => setIsLightboxOpen(false)}
                        aria-label="Close"
                        className="fixed top-4 right-4 w-10 h-10 flex justify-center items-center rounded-full bg-black/60 border border-white/20 text-white text-xl hover:bg-black/80 transition-colors"
                    >
                        &times;
                    </button>
                </div>
            )}
        </div>
    );
};

export default ConstructCard;
