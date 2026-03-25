import React from 'react';
import Page from '@components/Page';
import {useSeasonInfo} from '@hooks/useSeasonInfo';
import {useConstruct} from '@hooks/useConstruct';
import {getCurrentSeasonConstructs} from '@lib/construct/seasonConstructs';
import Link from 'next/link';

const SeasonPage = () => {
    const seasonInfo = useSeasonInfo();
    const constructs = getCurrentSeasonConstructs();

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
                </div>

                {/* Construct Cards Grid */}
                <div className="section-label">Constructs</div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6 max-md:grid-cols-1">
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

const ConstructSeasonCard: React.FC<ConstructSeasonCardProps> = ({contractId, name, order}) => {
    const isLocked = contractId.startsWith('TBD_');
    const {construct, loading} = useConstruct(isLocked ? null : contractId);

    if (isLocked) {
        return (
            <div className="glass-static overflow-hidden opacity-50 cursor-not-allowed">
                <div className="w-full aspect-video flex flex-col justify-center items-center gap-2 border-b border-[var(--glass-border)]" style={{background: 'linear-gradient(135deg, rgba(30,28,36,0.8), rgba(20,18,26,0.8))'}}>
                    <div className="text-5xl opacity-30">&#128274;</div>
                    <div
                        className="text-[var(--text-faint)] font-bold uppercase text-[0.75rem] tracking-widest"
                        style={{fontFamily: "'IBM Plex Mono', monospace"}}
                    >
                        Coming Soon
                    </div>
                    <div className="text-[var(--text-faint)] text-xs mt-1" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                        #{order}
                    </div>
                </div>
            </div>
        );
    }

    if (loading || !construct) {
        return (
            <div className="glass-static overflow-hidden">
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
        <Link href={`/construct/${construct.contractId}`} style={{textDecoration: 'none'}}>
            <div
                className={`glass-static overflow-hidden transition-all duration-200 cursor-pointer hover:-translate-y-1 ${
                    isActive ? 'hover:shadow-[0_8px_30px_rgba(197,164,78,0.2)]' : ''
                }`}
                style={isActive ? {borderColor: 'rgba(197,164,78,0.4)', boxShadow: '0 4px 20px rgba(197,164,78,0.15)'} : isDefeated ? {opacity: 0.7, borderColor: 'rgba(232,93,58,0.3)'} : {}}
            >
                <div className="relative w-full aspect-video overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover">
                    <img src={construct.imageUrl} alt={construct.name}/>
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
                <div className="p-5">
                    <h3
                        className="text-[1rem] font-semibold tracking-[0.06em] mb-3 text-[var(--text)]"
                        style={{fontFamily: "'Cinzel', serif"}}
                    >
                        {construct.name}
                    </h3>

                    {/* HP Bar */}
                    <div className="mb-3">
                        <div className="flex justify-between text-[0.7rem] mb-1.5" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                            <span className="text-[var(--text-dim)]">HP</span>
                            <span className="text-[var(--text-faint)]">
                                {construct.currentHp.toLocaleString()} / {construct.maxHp.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-2 bg-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden">
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
                            className="text-[var(--gold)] font-semibold text-[0.8rem] text-center mt-3 tracking-wide"
                            style={{fontFamily: "'Cinzel', serif"}}
                        >
                            Attack Now &rarr;
                        </div>
                    )}
                    {isDefeated && construct.finalBlowAccount && (
                        <div
                            className="text-[var(--text-faint)] text-xs text-center mt-2"
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
