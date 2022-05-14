import Page from '../components/Page'
import {memo, useEffect, useState} from 'react';
import {User} from '@lib/User.interface'
import styles from '../styles/Home.module.scss'
import {ConnectButton} from '@components/ConnectButton';
import {Address} from '@signumjs/core';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {fetchLeaderboard} from './api/leaderboard/fetchLeaderboard';

export async function getServerSideProps() {
    const {leaderboard, latestScores} = await fetchLeaderboard()
    return {
        props: {
            leaderboard: JSON.stringify(leaderboard),
            latestScores: JSON.stringify(latestScores),
        }
    }
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
    latestScores: string
}

const Home = ({leaderboard, latestScores}: HomeProps) => {
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
            <h1 className={styles.title}>
                Check your Signum blockchain score instantly
            </h1>

            <div className={`${styles.home} content`}>
                <div className={styles.connect}>
                    <ConnectButton withAddressInput/>
                </div>
                <div className={styles.homeRow}>
                    <div className={styles.leaderboard}>
                        <h2>Leaderboard</h2>
                        <ol>
                            {leaders.map((user: User, i: number) => (
                                <li key={i}>
                                    <Entry address={user.address} score={user.score}/>
                                </li>
                            ))}
                        </ol>
                    </div>
                    <div className={styles.leaderboard}>
                        <h2>Latest Scores</h2>
                        <ol>
                            {latestUsers.map((user: User, i: number) => (
                                <li key={i}>
                                    <Entry address={user.address} score={user.score}/>
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
}

const Entry = memo<EntryProps>(({address, score}) => {
    const prefix = useAddressPrefix()
    const displayName = Address.fromNumericId(address, prefix).getReedSolomonAddress()
    return (
        <span className={styles.entry}>
            <a href={`/address/${address}`}>{displayName}</a><span>{score}</span>
        </span>
    )
})

