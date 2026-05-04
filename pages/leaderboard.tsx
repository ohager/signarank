import {prisma} from '@lib/prisma';
import {User} from '@lib/User.interface';
import Page from '../components/Page';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {Address} from '@signumjs/core';
import {GetStaticProps} from 'next';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';
import {getExplorerBaseUrl} from '@lib/construct/constants';
import {memo, useState} from 'react';
import {useXpLeaderboard, XpLeaderboardEntry} from '@hooks/useXpLeaderboard';

export const getStaticProps: GetStaticProps = async () => {
    const leaderboard = await prisma.address.findMany({
        take: 100,
        where: {active: true},
        orderBy: {score: 'desc'},
    });

    return {
        props: {
            leaderboard: JSON.stringify(leaderboard),
            explorerBaseUrl: getExplorerBaseUrl(),
        },
        revalidate: ISR_REVALIDATE_SECONDS,
    };
};

interface LeaderboardParams {
    leaderboard: any;
    explorerBaseUrl: string;
}

const rankColors: Record<number, string> = {1: 'var(--gold-bright)', 2: '#c0c0c0', 3: '#cd7f32'};

const monoStyle = {fontFamily: "'IBM Plex Mono', monospace"} as const;
const cinzelStyle = {fontFamily: "'Cinzel', serif"} as const;

const TAB_HEADER_CLS = "px-4 py-2 text-[0.65rem] uppercase tracking-[0.15em] transition-colors border-b-2";

const Leaderboard = ({leaderboard, explorerBaseUrl}: LeaderboardParams) => {
    const leaders: User[] = JSON.parse(leaderboard);
    const [tab, setTab] = useState<'legacy' | 'xp'>('legacy');
    const {entries: xpEntries, loading: xpLoading} = useXpLeaderboard();

    return (
        <Page title="SIGNArank - Leaderboard">
            <div className="content-area">
                <div className="section-label">Leaderboard</div>

                <div className="glass-static overflow-hidden">
                    {/* Tab bar */}
                    <div className="flex border-b border-[var(--glass-border)]" style={monoStyle}>
                        <button
                            className={`${TAB_HEADER_CLS} ${tab === 'legacy' ? 'text-[var(--gold)] border-[var(--gold)]' : 'text-[var(--text-faint)] border-transparent hover:text-[var(--text-dim)]'}`}
                            onClick={() => setTab('legacy')}
                        >
                            ♟ Overall Ranking
                        </button>
                        <button
                            className={`${TAB_HEADER_CLS} ${tab === 'xp' ? 'text-[var(--gold)] border-[var(--gold)]' : 'text-[var(--text-faint)] border-transparent hover:text-[var(--text-dim)]'}`}
                            onClick={() => setTab('xp')}
                        >
                            ⚔ Top XP Hunters
                        </button>
                    </div>

                    {/* Column headers */}
                    <div
                        className="grid grid-cols-[48px_1fr_auto] items-center gap-4 px-6 py-2.5 border-b border-[rgba(255,255,255,0.06)]"
                        style={{...monoStyle, fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-faint)'}}
                    >
                        <span>Rank</span>
                        <span>Address</span>
                        <span>{tab === 'legacy' ? 'Score' : 'XP'}</span>
                    </div>

                    {tab === 'legacy' && leaders.map((user: User, i: number) => (
                        <LegacyRow
                            key={i}
                            rank={i + 1}
                            address={user.address}
                            score={user.score}
                            explorerBaseUrl={explorerBaseUrl}
                        />
                    ))}

                    {tab === 'xp' && xpLoading && (
                        <div
                            className="text-[var(--text-faint)] text-center py-16 text-[0.9rem]"
                            style={{fontFamily: "'Cormorant Garamond', serif"}}
                        >
                            Loading XP hunters...
                        </div>
                    )}

                    {tab === 'xp' && !xpLoading && xpEntries.map(entry => (
                        <XpRow
                            key={entry.account}
                            entry={entry}
                            explorerBaseUrl={explorerBaseUrl}
                        />
                    ))}

                    {tab === 'xp' && !xpLoading && xpEntries.length === 0 && (
                        <div
                            className="text-[var(--text-faint)] text-center py-16 text-[0.9rem]"
                            style={{fontFamily: "'Cormorant Garamond', serif"}}
                        >
                            No XP hunters found.
                        </div>
                    )}
                </div>
            </div>
        </Page>
    );
};

interface LegacyRowProps {
    rank: number;
    address: string;
    score: number;
    explorerBaseUrl: string;
}

const LegacyRow = memo<LegacyRowProps>(({rank, address, score, explorerBaseUrl}) => {
    const prefix = useAddressPrefix();
    const displayName = Address.fromNumericId(address, prefix).getReedSolomonAddress();
    const addressExplorerUrl = `${explorerBaseUrl}/address/${address}`;

    return (
        <div className="grid grid-cols-[48px_1fr_auto] items-center gap-4 px-6 py-3.5 border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.03)]">
            <span
                className="text-[0.85rem] font-semibold"
                style={{...monoStyle, color: rankColors[rank] || 'var(--text-faint)'}}
            >
                #{rank}
            </span>
            <span className="text-[0.8rem] overflow-hidden text-ellipsis whitespace-nowrap" style={monoStyle}>
                <a href={addressExplorerUrl} target="_blank" rel="noreferrer noopener" className="mr-1.5 opacity-50 hover:opacity-100 transition-opacity" title="Open in Explorer">&#127760;</a>
                <a href={`/address/${address}`} className="hover:text-[var(--gold)] transition-colors">{displayName}</a>
            </span>
            <span className="text-[0.95rem] font-bold text-[var(--gold)]" style={cinzelStyle}>
                {score}
            </span>
        </div>
    );
});

interface XpRowProps {
    entry: XpLeaderboardEntry;
    explorerBaseUrl: string;
}

const XpRow = memo<XpRowProps>(({entry, explorerBaseUrl}) => {
    const addressExplorerUrl = `${explorerBaseUrl}/address/${entry.account}`;

    return (
        <div className="grid grid-cols-[48px_1fr_auto] items-center gap-4 px-6 py-3.5 border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.03)]">
            <span
                className="text-[0.85rem] font-semibold"
                style={{...monoStyle, color: rankColors[entry.rank] || 'var(--text-faint)'}}
            >
                #{entry.rank}
            </span>
            <span className="text-[0.8rem] overflow-hidden text-ellipsis whitespace-nowrap" style={monoStyle}>
                <a href={addressExplorerUrl} target="_blank" rel="noreferrer noopener" className="mr-1.5 opacity-50 hover:opacity-100 transition-opacity" title="Open in Explorer">&#127760;</a>
                {entry.name && (
                    <span className="text-[var(--gold)] mr-1">[{entry.name}]</span>
                )}
                <a href={`/address/${entry.account}`} className="hover:text-[var(--gold)] transition-colors">{entry.accountRS}</a>
            </span>
            <span className="text-[0.95rem] font-bold text-[var(--gold)]" style={cinzelStyle}>
                {entry.xp.toLocaleString()}
            </span>
        </div>
    );
});

export default Leaderboard;
