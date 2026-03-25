import React from 'react';
import Page from '@components/Page';
import { useSeasonInfo } from '@hooks/useSeasonInfo';
import { useConstruct } from '@hooks/useConstruct';
import { getCurrentSeasonConstructs } from '@lib/construct/seasonConstructs';
import Link from 'next/link';

const SeasonPage = () => {
    const seasonInfo = useSeasonInfo();
    const constructs = getCurrentSeasonConstructs();

    return (
        <Page title={`${seasonInfo.name} Season - SIGNArank`}>
            <div className="max-w-[1200px] mx-auto p-8 max-md:p-4 content">
                <div className="text-center mb-12">
                    <h1 className="text-[2.5rem] mb-4 text-white max-md:text-[2rem]">{seasonInfo.name} Season</h1>
                    <p className="text-white/70 max-w-[600px] mx-auto text-base leading-relaxed">{seasonInfo.description}</p>
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-8 mt-8 max-md:grid-cols-1 max-md:gap-4">
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

const ConstructSeasonCard: React.FC<ConstructSeasonCardProps> = ({ contractId, name, order }) => {
    const isLocked = contractId.startsWith('TBD_');
    const { construct, loading } = useConstruct(isLocked ? null : contractId);

    if (isLocked) {
        return (
            <div className="bg-black/60 rounded-2xl overflow-hidden border border-white/10 backdrop-blur-sm cursor-not-allowed opacity-50 relative">
                <div className="w-full aspect-video bg-gradient-to-br from-[rgba(50,50,50,0.8)] to-[rgba(30,30,30,0.8)] flex flex-col justify-center items-center gap-2 border-b border-white/10">
                    <div className="text-5xl opacity-30">🔒</div>
                    <div className="text-white/40 font-bold uppercase text-[0.9rem] tracking-widest">Coming Soon</div>
                    <div className="text-white/30 text-xs mt-1">#{order}</div>
                </div>
            </div>
        );
    }

    if (loading || !construct) {
        return (
            <div className="bg-black/60 rounded-2xl overflow-hidden border border-white/10 backdrop-blur-sm">
                <div className="p-8 text-center text-white/50">Loading...</div>
            </div>
        );
    }

    const hpPercent = construct.maxHp > 0 ? construct.currentHp / construct.maxHp : 0;
    const isActive = construct.isActive && !construct.isDefeated;
    const isDefeated = construct.isDefeated;

    return (
        <Link href={`/construct/${construct.contractId}`} style={{ textDecoration: 'none' }}>
            <div
                className={`bg-black/60 rounded-2xl overflow-hidden border backdrop-blur-sm transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(217,4,142,0.3)] ${
                    isActive ? 'border-2 border-[rgba(0,255,136,0.5)] shadow-[0_4px_20px_rgba(0,255,136,0.3)]' : isDefeated ? 'opacity-70 border-[rgba(239,68,68,0.3)]' : 'border-white/10'
                }`}
            >
                <div className="relative w-full aspect-video overflow-hidden [&_img]:w-full [&_img]:h-full [&_img]:object-cover">
                    <img src={construct.imageUrl} alt={construct.name} />
                    {isActive && <div className="absolute top-2.5 right-2.5 bg-[rgba(0,255,136,0.9)] text-black py-1.5 px-3 rounded-full text-xs font-bold uppercase tracking-wide animate-pulse">⚡ ACTIVE</div>}
                    {isDefeated && <div className="absolute top-2.5 right-2.5 bg-[rgba(239,68,68,0.9)] text-white py-1.5 px-3 rounded-full text-xs font-bold uppercase tracking-wide">💀 DEFEATED</div>}
                </div>
                <div className="p-4">
                    <h3 className="text-[1.1rem] font-bold text-white m-0 mb-3">{construct.name}</h3>
                    <div className="mb-3">
                        <div className="flex justify-between text-white/80 text-[0.8rem] mb-1.5 font-medium">
                            <span>HP</span>
                            <span>
                                {construct.currentHp.toLocaleString()} / {construct.maxHp.toLocaleString()}
                            </span>
                        </div>
                        <div className="h-3 bg-white/10 rounded-md overflow-hidden">
                            <div
                                className="h-full rounded-md transition-[width] duration-300"
                                style={{
                                    width: `${hpPercent * 100}%`,
                                    backgroundColor:
                                        hpPercent > 0.5
                                            ? '#4ade80'
                                            : hpPercent > 0.25
                                            ? '#fbbf24'
                                            : '#ef4444',
                                }}
                            />
                        </div>
                    </div>
                    {isActive && <div className="text-[#D9048E] font-semibold text-[0.9rem] text-center mt-2">Attack Now →</div>}
                    {isDefeated && construct.finalBlowAccount && (
                        <div className="text-white/50 text-xs text-center mt-2 font-mono">
                            Victor: {construct.finalBlowAccount.slice(0, 10)}...
                        </div>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default SeasonPage;
