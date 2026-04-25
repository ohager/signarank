import React from 'react';
import Link from 'next/link';
import { useSeasonInfo } from '@hooks/useSeasonInfo';
import { useConstruct } from '@hooks/useConstruct';
import { getCurrentSeasonConstructs } from '@lib/construct/seasonConstructs';

export const SeasonBanner: React.FC = () => {
    const { name, isCurrent, description } = useSeasonInfo();
    const firstConstructId = getCurrentSeasonConstructs().find(c => !c.locked)?.contractId ?? null;
    const { construct, loading } = useConstruct(firstConstructId);

    if (!isCurrent || !name) {
        return null;
    }

    return (
        <div className="relative group max-md:hidden">
            {/* Badge pill — links to season page */}
            <Link
                href="/season"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--gold-dim)] bg-[rgba(197,164,78,0.06)] hover:bg-[rgba(197,164,78,0.12)] hover:border-[var(--gold)] transition-all duration-200"
            >
                {!loading && construct?.imageUrl && (
                    <img
                        src={construct.imageUrl}
                        alt={construct.name}
                        className="w-5 h-5 rounded-full object-cover border border-[var(--gold-dim)]"
                    />
                )}
                <span
                    className="text-[0.6rem] tracking-[0.08em] uppercase text-[var(--gold)]"
                    style={{fontFamily: "'IBM Plex Mono', monospace"}}
                >
                    {name}
                </span>
            </Link>

            {/* Hover dropdown */}
            <div className="absolute top-full left-0 mt-2 w-[320px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="glass-static p-4 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
                    {/* Season info */}
                    <div className="mb-3">
                        <span
                            className="text-[0.55rem] tracking-[0.15em] uppercase text-[var(--gold)] block mb-1"
                            style={{fontFamily: "'IBM Plex Mono', monospace"}}
                        >
                            Current Season
                        </span>
                        <h4
                            className="text-sm font-semibold tracking-wide m-0 mb-2"
                            style={{fontFamily: "'Cinzel', serif"}}
                        >
                            {name}
                        </h4>
                        {description && (
                            <p
                                className="text-[0.82rem] leading-relaxed text-[var(--text-dim)] m-0"
                                style={{fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic'}}
                            >
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Links */}
                    <div className="pt-3 border-t border-[var(--glass-border)]">
                        <Link
                            href="/season"
                            className="block text-center py-2 text-[0.6rem] tracking-[0.1em] uppercase text-[var(--gold)] border border-[var(--gold-dim)] rounded-sm hover:bg-[var(--gold)] hover:text-[#080610] transition-all duration-200"
                            style={{fontFamily: "'Cinzel', serif", fontWeight: 600}}
                        >
                            Season Details
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
