import Page from '../components/Page'
import {memo, useEffect, useState} from 'react';
import {User} from '@lib/User.interface'
import {ConnectButton} from '@components/ConnectButton';
import {Address} from '@signumjs/core';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {fetchLeaderboard} from './api/leaderboard/fetchLeaderboard';
import {GetStaticProps} from 'next';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';
import {getExplorerBaseUrl} from '@lib/explorerUrl';

// ISR: Statically generate homepage and regenerate every 30 minutes
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
            .then(() => fetch('/api/leaderboard', ))
            .then((response) => response.json())
            .then((result) => {
                setLatestUsers(result.latestScores)
                setLeaders(result.leaderboard)
            })
            .catch(console.error)

    }, [])

    return (
        <Page title="SIGNArank - An achievement system built on the Signum blockchain">
            <h1 className="text-center text-5xl normal-case max-w-[700px] mx-auto mt-[50px]">
                Check your Signum blockchain score instantly
            </h1>

            <div className="text-center content">
                <div className="mx-auto max-w-[280px]">
                    <ConnectButton withAddressInput/>
                </div>
                <div className="mt-5 grid grid-cols-[48%_48%] text-left gap-y-[30px] gap-x-[6%] justify-items-center max-sm:grid-cols-1 [&_ol]:m-0 [&_ol]:p-0 [&_ol]:list-inside [&_li]:p-0 [&_li]:my-2.5">
                    <div>
                        <h2>Leaderboard</h2>
                        <ol>
                            {leaders.map((user: User, i: number) => (
                                <li key={i}>
                                    <Entry address={user.address} score={user.score} explorerBaseUrl={explorerBaseUrl}/>
                                </li>
                            ))}
                        </ol>
                    </div>
                    <div>
                        <h2>Latest Scores</h2>
                        <ol>
                            {latestUsers.map((user: User, i: number) => (
                                <li key={i}>
                                    <Entry address={user.address} score={user.score} explorerBaseUrl={explorerBaseUrl}/>
                                </li>
                            ))}
                        </ol>
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
}

const Entry = memo<EntryProps>(({address, score, explorerBaseUrl}) => {
    const prefix = useAddressPrefix()
    const displayName = Address.fromNumericId(address, prefix).getReedSolomonAddress()
    const addressExplorerUrl = `${explorerBaseUrl}/address/${address}`
    return (
        <span className="inline-flex flex-row justify-between">
            <a title="Open in Explorer" className="explorer-link" style={{marginRight: "0.2rem"}} href={addressExplorerUrl} target="_blank" rel="noreferrer noopener">🌐 </a>
            <a href={`/address/${address}`}>{displayName}</a><span className="pl-[30px]">{score}</span>
        </span>
    )
})
