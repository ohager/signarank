import styles from '../styles/Leaderboard.module.scss'
import {prisma} from '@lib/prisma';
import {User} from '@lib/User.interface';
import Page from '../components/Page';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {Address} from '@signumjs/core';


export async function getServerSideProps() {

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
            leaderboard: JSON.stringify(leaderboard)
        }
    }
}

// TODO type it
interface LeaderboardParams {
    leaderboard: any
}

const Leaderboard = ({leaderboard}: LeaderboardParams) => {
    const prefix = useAddressPrefix()
    const leaders = JSON.parse(leaderboard);

    return <Page title="SIGNArank - Leaderboard">
        <div className="content">
            <div>
                <h3>Leaderboard</h3>
                <ol className={`${styles.cellParent} ${styles.achivements}`}>
                    {leaders.map((user: User, i: number) => {
                        const displayName = Address.create(user.address, prefix).getReedSolomonAddress();
                        return <li key={i} className={`${styles.user} user`}>
                            <h4><a href={`/address/${user.address}`}>{displayName}</a></h4>
                            <span>{user.score}</span>
                        </li>
                    })}
                </ol>
            </div>
        </div>
    </Page>
}

export default Leaderboard
