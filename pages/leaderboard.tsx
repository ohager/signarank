import {prisma} from '@lib/prisma';
import {User} from '@lib/User.interface';
import Page from '../components/Page';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {Address} from '@signumjs/core';
import {GetStaticProps} from 'next';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';
import {getExplorerBaseUrl} from '@lib/construct/constants';
import {memo} from 'react';


// ISR: Statically generate leaderboard and regenerate every 30 minutes
export const getStaticProps: GetStaticProps = async () => {
    const leaderboard = await prisma.address.findMany({
        take: 100,
        where: {
            active: true
        },
        orderBy: {
            score: 'desc'
        }
    });

    return {
        props: {
            leaderboard: JSON.stringify(leaderboard),
            explorerBaseUrl: getExplorerBaseUrl(),
        },
        revalidate: ISR_REVALIDATE_SECONDS
    };
}

interface LeaderboardParams {
    leaderboard: any,
    explorerBaseUrl: string
}

const rankColors: Record<number, string> = {1: 'var(--gold-bright)', 2: '#c0c0c0', 3: '#cd7f32'};

const Leaderboard = ({leaderboard, explorerBaseUrl}: LeaderboardParams) => {
    const leaders: User[] = JSON.parse(leaderboard);

    return (
        <Page title="SIGNArank - Leaderboard">
            <div className="content-area">
                <div className="section-label">Leaderboard</div>

                <div className="glass-static overflow-hidden">
                    <div
                        className="px-6 py-4 border-b border-[var(--glass-border)] flex items-center gap-2.5"
                        style={{fontFamily: "'Cinzel', serif", fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' as const}}
                    >
                        <span className="text-[var(--gold)]">&#9819;</span> Top 100 Accounts
                    </div>

                    {/* Column headers */}
                    <div
                        className="grid grid-cols-[48px_1fr_auto] items-center gap-4 px-6 py-2.5 border-b border-[rgba(255,255,255,0.06)]"
                        style={{fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'var(--text-faint)'}}
                    >
                        <span>Rank</span>
                        <span>Address</span>
                        <span>Score</span>
                    </div>

                    {leaders.map((user: User, i: number) => (
                        <LeaderboardRow
                            key={i}
                            rank={i + 1}
                            address={user.address}
                            score={user.score}
                            explorerBaseUrl={explorerBaseUrl}
                        />
                    ))}
                </div>
            </div>
        </Page>
    );
}

interface LeaderboardRowProps {
    rank: number;
    address: string;
    score: number;
    explorerBaseUrl: string;
}

const LeaderboardRow = memo<LeaderboardRowProps>(({rank, address, score, explorerBaseUrl}) => {
    const prefix = useAddressPrefix();
    const displayName = Address.fromNumericId(address, prefix).getReedSolomonAddress();
    const addressExplorerUrl = `${explorerBaseUrl}/address/${address}`;

    return (
        <div className="grid grid-cols-[48px_1fr_auto] items-center gap-4 px-6 py-3.5 border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.03)] cursor-pointer">
            <span
                className="text-[0.85rem] font-semibold"
                style={{fontFamily: "'IBM Plex Mono', monospace", color: rankColors[rank] || 'var(--text-faint)'}}
            >
                #{rank}
            </span>
            <span className="text-[0.8rem] overflow-hidden text-ellipsis whitespace-nowrap" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                <a href={addressExplorerUrl} target="_blank" rel="noreferrer noopener" className="mr-1.5 opacity-50 hover:opacity-100 transition-opacity" title="Open in Explorer">&#127760;</a>
                <a href={`/address/${address}`} className="hover:text-[var(--gold)] transition-colors">{displayName}</a>
            </span>
            <span
                className="text-[0.95rem] font-bold text-[var(--gold)]"
                style={{fontFamily: "'Cinzel', serif"}}
            >
                {score}
            </span>
        </div>
    );
});

export default Leaderboard
