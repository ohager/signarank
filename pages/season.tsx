import React, { useRef } from 'react';
import Page from '@components/Page';
import {useSeasonInfo} from '@hooks/useSeasonInfo';
import {useConstruct} from '@hooks/useConstruct';
import {useConstructDisplayImage} from '@hooks/useConstructDisplayImage';
import {getCurrentSeasonConstructs} from '@lib/construct/seasonConstructs';
import Link from 'next/link';

const CARD_WIDTH = 280 + 20; // card width + gap

const SeasonPage = () => {
    const seasonInfo = useSeasonInfo();
    const constructs = getCurrentSeasonConstructs();
    const scrollRef = useRef<HTMLDivElement>(null);

    const scroll = (dir: 'left' | 'right') => {
        scrollRef.current?.scrollBy({ left: dir === 'right' ? CARD_WIDTH : -CARD_WIDTH, behavior: 'smooth' });
    };

    return (
        <Page title={`${seasonInfo.name} Season - SIGNArank`}>
            <div className="content-area">
                {/* Season Header */}
                <div className="text-center mb-12">
                    <h1
                        className="text-[clamp(2rem,5vw,3rem)] font-bold tracking-[0.04em] uppercase mb-4"
                        style={{fontFamily: "'Cinzel', serif"}}
                    >
                        <span
                            className="inline-block animate-[shimmer_6s_linear_infinite]"
                            style={{
                                background: 'linear-gradient(90deg, var(--text) 0%, var(--gold-bright) 25%, var(--text) 50%, var(--gold-bright) 75%, var(--text) 100%)',
                                backgroundSize: '200% auto',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}
                        >
                            {seasonInfo.name} Season
                        </span>
                    </h1>
                    <p
                        className="text-xl font-medium text-[var(--text)] max-w-[600px] mx-auto leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
                        style={{fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic'}}
                    >
                        {seasonInfo.description}
                    </p>
                    <div className="mt-5">
                        <Link
                            href="/rules"
                            className="inline-flex items-center gap-2 py-2 px-5 rounded-sm text-[0.7rem] font-semibold uppercase tracking-[0.15em] transition-all duration-200 hover:brightness-110 active:scale-95"
                            style={{
                                fontFamily: "'Cinzel', serif",
                                background: 'rgba(6,4,10,0.75)',
                                border: '1px solid rgba(197,164,78,0.6)',
                                color: 'var(--gold)',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                                backdropFilter: 'blur(8px)',
                            }}
                        >
                            <span>How to Play</span>
                            <span>→</span>
                        </Link>
                    </div>
                </div>

                {/* Construct Cards Carousel */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="section-label !mb-0">Constructs</div>
                    <div className="flex gap-1 ml-auto">
                        {(['left', 'right'] as const).map(dir => (
                            <button
                                key={dir}
                                onClick={() => scroll(dir)}
                                className="w-8 h-8 flex items-center justify-center rounded-sm border transition-all duration-150 hover:brightness-125 active:scale-95"
                                style={{
                                    background: 'rgba(197,164,78,0.06)',
                                    borderColor: 'rgba(197,164,78,0.2)',
                                    color: 'var(--gold)',
                                }}
                            >
                                {dir === 'left' ? '‹' : '›'}
                            </button>
                        ))}
                    </div>
                </div>
                <div
                    ref={scrollRef}
                    className="flex gap-5 overflow-x-auto pb-3 max-md:gap-3 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {constructs.map((constructConfig) => (
                        <ConstructSeasonCard
                            key={constructConfig.contractId}
                            contractId={constructConfig.contractId}
                            order={constructConfig.order}
                            locked={constructConfig.locked}
                        />
                    ))}
                </div>
            </div>
        </Page>
    );
};

interface ConstructSeasonCardProps {
    contractId: string;
    order: number;
    locked: boolean;
}

const ConstructSeasonCard: React.FC<ConstructSeasonCardProps> = ({contractId, order, locked}) => {
    const {construct, loading} = useConstruct(locked ? null : contractId);
    const {displayImageUrl, handleImageError} = useConstructDisplayImage(construct);

    if (locked) {
        return (
            <div className="glass-static overflow-hidden opacity-50 cursor-not-allowed shrink-0 w-[280px] max-md:w-[200px] snap-start">
                <div className="w-full aspect-[3/4] flex flex-col justify-center items-center gap-2 border-b border-[var(--glass-border)] p-3" style={{background: 'linear-gradient(135deg, rgba(30,28,36,0.8), rgba(20,18,26,0.8))'}}>
                    <div className="text-5xl opacity-30 max-md:text-4xl">&#128274;</div>
                    <div
                        className="text-[var(--text-faint)] font-bold uppercase text-[0.75rem] tracking-widest text-center max-md:text-[0.65rem]"
                        style={{fontFamily: "'IBM Plex Mono', monospace"}}
                    >
                        Coming Soon
                    </div>
                    <div className="text-[var(--text-faint)] text-xs mt-1 max-md:text-[0.6rem]" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                        #{order}
                    </div>
                </div>
            </div>
        );
    }

    if (loading || !construct) {
        return (
            <div className="glass-static overflow-hidden shrink-0 w-[280px] max-md:w-[200px] snap-start">
                <div className="p-8 text-center text-[var(--text-faint)]" style={{fontFamily: "'Cormorant Garamond', serif"}}>
                    Loading...
                </div>
            </div>
        );
    }

    const hpPercent = construct.maxHp > 0 ? construct.currentHp / construct.maxHp : 0;
    const isActive = construct.isActive && !construct.isDefeated;
    const isDefeated = construct.isDefeated;

    return (
        <Link href={`/construct/${construct.contractId}`} style={{textDecoration: 'none'}} className="shrink-0 w-[280px] max-md:w-[200px] snap-start">
            <div
                className={`glass-static overflow-hidden transition-all duration-200 cursor-pointer hover:-translate-y-1 h-full ${
                    isActive ? 'hover:shadow-[0_8px_30px_rgba(197,164,78,0.2)]' : ''
                }`}
                style={isActive ? {borderColor: 'rgba(197,164,78,0.4)', boxShadow: '0 4px 20px rgba(197,164,78,0.15)'} : isDefeated ? {opacity: 0.7, borderColor: 'rgba(232,93,58,0.3)'} : {}}
            >
                <div className="relative w-full aspect-[3/4] overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:object-center">
                    <img src={displayImageUrl} alt={construct.name} onError={handleImageError}/>
                    {isActive && (
                        <div
                            className="absolute top-2.5 right-2.5 py-1.5 px-3 rounded-full text-[0.65rem] font-bold uppercase tracking-wide animate-pulse"
                            style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                background: 'linear-gradient(135deg, rgba(197,164,78,0.9), rgba(232,200,90,0.9))',
                                color: '#080610'
                            }}
                        >
                            Active
                        </div>
                    )}
                    {isDefeated && (
                        <div
                            className="absolute top-2.5 right-2.5 py-1.5 px-3 rounded-full text-[0.65rem] font-bold uppercase tracking-wide"
                            style={{
                                fontFamily: "'IBM Plex Mono', monospace",
                                background: 'rgba(232,93,58,0.9)',
                                color: '#fff'
                            }}
                        >
                            Defeated
                        </div>
                    )}
                </div>
                <div className="p-5 max-md:p-3">
                    <h3
                        className="text-[1rem] font-semibold tracking-[0.06em] mb-3 text-[var(--text)] max-md:text-[0.85rem] max-md:mb-2 leading-tight"
                        style={{fontFamily: "'Cinzel', serif"}}
                    >
                        {construct.name}
                    </h3>

                    {/* HP Bar */}
                    <div className="mb-3 max-md:mb-2">
                        <div className="flex justify-between text-[0.7rem] mb-1.5 max-md:text-[0.6rem] max-md:mb-1" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                            <span className="text-[var(--text-dim)]">HP</span>
                            <span className="text-[var(--text-faint)] truncate ml-2">
                                {construct.currentHp.toLocaleString()} / {construct.maxHp.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-2 bg-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden max-md:h-1.5">
                            <div
                                className="h-full rounded-sm transition-[width] duration-300"
                                style={{
                                    width: `${hpPercent * 100}%`,
                                    background:
                                        hpPercent > 0.5
                                            ? 'linear-gradient(90deg, #4ade80, #22c55e)'
                                            : hpPercent > 0.25
                                            ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                                            : 'linear-gradient(90deg, #ef4444, var(--ember))',
                                }}
                            />
                        </div>
                    </div>

                    {isActive && (
                        <div
                            className="text-[var(--gold)] font-semibold text-[0.8rem] text-center mt-3 tracking-wide max-md:text-[0.7rem] max-md:mt-2"
                            style={{fontFamily: "'Cinzel', serif"}}
                        >
                            Attack Now &rarr;
                        </div>
                    )}
                    {isDefeated && construct.finalBlowAccount && (
                        <div
                            className="text-[var(--text-faint)] text-xs text-center mt-2 truncate max-md:text-[0.6rem]"
                            style={{fontFamily: "'IBM Plex Mono', monospace"}}
                        >
                            Victor: {construct.finalBlowAccount.slice(0, 10)}...
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default SeasonPage;
