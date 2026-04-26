import Page from '../components/Page'
import {memo, useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {User} from '@lib/User.interface'
import {ConnectButton} from '@components/ConnectButton';
import {Address} from '@signumjs/core';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {fetchLeaderboard} from './api/leaderboard/fetchLeaderboard';
import {GetStaticProps} from 'next';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';
import {getExplorerBaseUrl} from '@lib/construct/constants';

export const getStaticProps: GetStaticProps = async () => {
    const {leaderboard, latestScores} = await fetchLeaderboard();

    return {
        props: {
            leaderboard: JSON.stringify(leaderboard),
            latestScores: JSON.stringify(latestScores),
            explorerBaseUrl: getExplorerBaseUrl(),
        },
        revalidate: ISR_REVALIDATE_SECONDS
    };
}

function updateLeaderboardAccounts(leaders: any[], latest: any[]) {
    const uniqueAccounts = new Set<string>()
    leaders.concat(latest).forEach(({address}: any) => {
        address && uniqueAccounts.add(address)
    })
    const promises = Array.from(uniqueAccounts).map((address: string) => fetch(`api/score/${address}`))
    return Promise.all(promises)
}

interface HomeProps {
    leaderboard: string,
    latestScores: string,
    explorerBaseUrl: string
}

const Home = ({leaderboard, latestScores, explorerBaseUrl}: HomeProps) => {
    const [leaders, setLeaders] = useState(JSON.parse(leaderboard))
    const [latestUsers, setLatestUsers] = useState(JSON.parse(latestScores))

    useEffect(() => {
        updateLeaderboardAccounts(leaders, latestUsers)
            .then(() => fetch('/api/leaderboard'))
            .then((response) => response.json())
            .then((result) => {
                setLatestUsers(result.latestScores)
                setLeaders(result.leaderboard)
            })
            .catch(console.error)
    }, [])

    return (
        <Page title="SIGNArank - An achievement system built on the Signum blockchain">
            {/* Hero */}
            <section className="min-h-[80vh] md:min-h-[85vh] flex flex-col items-center justify-center text-center px-4 md:px-8 relative">
                {/* Ambient glow */}
                <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] pointer-events-none" style={{background: 'radial-gradient(circle, rgba(197,164,78,0.06) 0%, rgba(126,200,227,0.03) 40%, transparent 70%)'}} />

                <div className="text-[0.65rem] tracking-[0.4em] uppercase text-[var(--gold)] mb-5 flex items-center gap-4" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                    <span className="w-[50px] h-px" style={{background: 'linear-gradient(90deg, transparent, var(--gold), transparent)'}} />
                    Signum Blockchain
                    <span className="w-[50px] h-px" style={{background: 'linear-gradient(90deg, transparent, var(--gold), transparent)'}} />
                </div>

                <h1 className="text-[clamp(2rem,6vw,5rem)] font-extrabold leading-[1.1] tracking-[0.02em] uppercase mb-4 md:mb-6" style={{fontFamily: "'Cinzel', serif"}}>
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
                        Your On-Chain<br/>Legend Awaits
                    </span>
                </h1>

                <p className="text-lg md:text-2xl font-medium italic text-[var(--text)] max-w-[520px] leading-relaxed mb-8 md:mb-12 drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]" style={{fontFamily: "'Cormorant Garamond', serif"}}>
                    Track your Signum blockchain deeds, earn achievements, and rise through the ranks.
                </p>

                {/* Connect box */}
                <div className="w-full max-w-[460px]">
                    <div className="glass-static p-5 md:p-7">
                        <ConnectButton mode="full" withAddressInput/>
                    </div>
                </div>

                {/* Scroll hint */}
                <div className="hidden md:flex absolute bottom-10 left-1/2 -translate-x-1/2 flex-col items-center gap-2 text-[var(--text-faint)] text-[0.6rem] tracking-[0.2em] uppercase animate-[breathe_3s_ease-in-out_infinite]" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                    Scroll
                    <div className="w-px h-[30px]" style={{background: 'linear-gradient(to bottom, var(--text-faint), transparent)'}} />
                </div>
            </section>

            {/* Rankings */}
            <div className="content-area">
                <div className="section-label">Rankings</div>

                <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1">
                    {/* Top Ranks */}
                    <div className="glass-static overflow-hidden">
                        <div className="px-3 md:px-6 py-3 md:py-4 border-b border-[var(--glass-border)] flex items-center gap-2.5" style={{fontFamily: "'Cinzel', serif", fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' as const}}>
                            <span className="text-[var(--gold)]">♛</span> Top Ranks
                        </div>
                        {leaders.map((user: User, i: number) => (
                            <Entry key={i} rank={i + 1} address={user.address} score={user.score} title={user.title} explorerBaseUrl={explorerBaseUrl}/>
                        ))}
                    </div>

                    {/* Latest Scores */}
                    <div className="glass-static overflow-hidden">
                        <div className="px-3 md:px-6 py-3 md:py-4 border-b border-[var(--glass-border)] flex items-center gap-2.5" style={{fontFamily: "'Cinzel', serif", fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase' as const}}>
                            <span className="text-[var(--gold)]">⚡</span> Latest Scores
                        </div>
                        {latestUsers.map((user: User, i: number) => (
                            <Entry key={i} address={user.address} score={user.score} title={user.title} explorerBaseUrl={explorerBaseUrl}/>
                        ))}
                    </div>
                </div>
            </div>
        </Page>
    )
}
export default Home

interface EntryProps {
    address: string
    score: number
    explorerBaseUrl: string
    rank?: number
    title?: string
}

const Entry = memo<EntryProps>(({address, score, explorerBaseUrl, rank, title}) => {
    const router = useRouter()
    const prefix = useAddressPrefix()
    const displayName = Address.fromNumericId(address, prefix).getReedSolomonAddress()
    const addressExplorerUrl = `${explorerBaseUrl}/address/${address}`

    const rankColors: Record<number, string> = {1: 'var(--gold-bright)', 2: '#c0c0c0', 3: '#cd7f32'}

    const handleRowClick = () => {
        router.push(`/address/${address}`)
    }

    const handleGlobeClick = (e: React.MouseEvent) => {
        e.stopPropagation()
    }

    return (
        <div
            role="link"
            tabIndex={0}
            onClick={handleRowClick}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick() }}
            className="grid grid-cols-[28px_1fr_auto] md:grid-cols-[36px_1fr_auto] items-center gap-2 md:gap-4 px-3 md:px-6 py-3 border-b border-[rgba(255,255,255,0.03)] transition-colors hover:bg-[rgba(255,255,255,0.03)] cursor-pointer focus:outline-none focus:bg-[rgba(255,255,255,0.04)]"
        >
            <span className="text-[0.7rem] md:text-[0.8rem] font-semibold" style={{fontFamily: "'IBM Plex Mono', monospace", color: rank ? (rankColors[rank] || 'var(--text-faint)') : 'var(--text-faint)'}}>
                {rank ? `#${rank}` : '—'}
            </span>
            <span className="min-w-0 flex flex-col gap-0.5">
                <span className="text-[0.65rem] md:text-[0.8rem] truncate" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                    <a
                        href={addressExplorerUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={handleGlobeClick}
                        className="mr-1 opacity-50 hover:opacity-100 transition-opacity hidden md:inline"
                        title="Open in Explorer"
                    >🌐</a>
                    <span className="hover:text-[var(--gold)] transition-colors">{displayName}</span>
                </span>
                {title && (
                    <span
                        className="text-[0.65rem] md:text-[0.72rem] font-semibold tracking-[0.15em] uppercase truncate"
                        style={{fontFamily: "'Cinzel', serif", color: 'var(--gold-bright)'}}
                    >
                        {title}
                    </span>
                )}
            </span>
            <span className="text-[0.8rem] md:text-[0.95rem] font-bold text-[var(--gold)]" style={{fontFamily: "'Cinzel', serif"}}>{score}</span>
        </div>
    )
})
