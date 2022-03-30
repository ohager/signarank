import styles from '../styles/Leaderboard.module.scss'
import prisma from '../lib/prisma';
import { User } from '../lib/User.interface';
import Page from '../components/Page';


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
      leaderboard
    }
  }
}

// TODO type it
interface LeaderboardParams {
  leaderboard: any
}

const Leaderboard = ({ leaderboard }: LeaderboardParams) => {
  return <Page title="SIGNArank - Leaderboard">
    <div className="content">
      <div>
        <h3>Leaderboard</h3>
        <ol className={`${styles.cellParent} ${styles.achivements}`}>
          {leaderboard.map((user: User, i: number) => {
            let displayName = user.address;
            if (user.name && user.name.length) {
              displayName = user.name
            }
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
