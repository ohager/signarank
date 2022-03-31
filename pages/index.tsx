import Page from '../components/Page'
import prisma from '../lib/prisma'
import {User} from '../lib/User.interface'
import styles from '../styles/Home.module.scss'
import {ConnectButton} from '@components/ConnectButton';
import {Address} from '@signumjs/core';
import {useCallback} from 'react';
import {useAddressPrefix} from '@hooks/useAddressPrefix';

export async function getServerSideProps() {

    const leaderboard = await prisma.address.findMany({
        take: 4,
        where: {
            active: true
        },
        orderBy: {
            score: 'desc'
        }
    });
    const latestScores = await prisma.address.findMany({
        take: 4,
        where: {
            active: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    return {
        props: {
            leaderboard: JSON.stringify(leaderboard),
            latestScores: JSON.stringify(latestScores),
        }
    }
}

interface HomeProps {
    leaderboard: string,
    latestScores: string
}

const Home = ({leaderboard, latestScores}: HomeProps) => {
    const prefix = useAddressPrefix()
    const leaders = JSON.parse(leaderboard)
    const latestUsers = JSON.parse(latestScores)

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
                            {leaders.map((user: User, i: number) => {
                                const displayName = Address.fromNumericId(user.address, prefix).getReedSolomonAddress()
                                return <li key={i}><a
                                    href={`/address/${user.address}`}>{displayName}</a><span>{user.score}</span></li>
                            })}
                        </ol>
                    </div>
                    <div className={styles.leaderboard}>
                        <h2>Latest Scores</h2>
                        <ol>
                            {latestUsers.map((user: User, i: number) => {
                                const displayName = Address.fromNumericId(user.address, prefix).getReedSolomonAddress()
                                return <li key={i}><a
                                    href={`/address/${user.address}`}>{displayName}</a><span>{user.score}</span></li>
                            })}
                        </ol>
                    </div>
                </div>
            </div>
        </Page>
    )
}

export default Home
