

import { useRouter } from 'next/router'
import styles from '../../../styles/Address.module.scss'
import achievements from '@lib/achievements.signa.json';
import Link from 'next/link';
import { AddressProps } from "../[address]"
import ProgressBar from '../../../components/ProgressBar';
import Score from '../../../components/Score';
import { GetStaticProps, GetStaticPaths } from 'next';
import Page from '../../../components/Page';
import {useReedSolomonAddress} from '@hooks/useReedSolomonAddress';
import {calculateScore} from '../../api/score/calculateSignaScore';
import {singleQueryString} from '@lib/singleQueryString';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';

// Generate on-demand with ISR (fallback: blocking)
// Pre-generating all address+achievement combinations would be too many paths
export const getStaticPaths: GetStaticPaths = async () => {
    return {
        paths: [], // Generate on-demand
        fallback: 'blocking'
    };
};

export const getStaticProps: GetStaticProps = async ({params}) => {
    const address = singleQueryString(params?.address);
    const result = await calculateScore(address);

    return {
        props: result.props,
        revalidate: ISR_REVALIDATE_SECONDS
    };
};

const Achievement = ({ score, rank, progress, name, address }: AddressProps) => {

  const router = useRouter()
  const { achievementSlug } = router.query;

  const  displayAddress = useReedSolomonAddress(address)
  const achievementIndex = achievements.findIndex((potentialMatch) => {
    return potentialMatch.slug.toLowerCase() === achievementSlug && achievementSlug.toLowerCase();
  })

  const achievement = achievements[achievementIndex];

  const calculateProgress = function (i: number) {
    const results = progress.filter((item: string) => {
      return item[0] === achievementIndex.toString() && item[1] === i.toString() && item.length === 3
    });

    if (results && results.length) {
      return results.length;
    } else return 0;
  };

  if (!name?.length) {
    name = undefined
  }

  return <Page title={`${displayAddress} - SIGNArank`}>
    <div className="content">
      <div className={styles.address}>
        <h2 className="gradient-box gradient-bottom-only">{name || displayAddress}</h2>
      </div>
      <Score score={score} rank={rank} />
      <div>
        <ul className="breadcrumbs">
          <li><a href={`/address/${address}/`}>{displayAddress}</a></li>
          <li className="on">{achievement.name}</li>
        </ul>
        <h3>{achievement && achievement.name}</h3>
        <div className={styles.cellParent}>
          {achievement && achievement.goals.map((goal, i) => {
            return <Link key={i} href={{
              pathname: '/address/[address]/[achievement]/[goal]',
              query: { address, achievement: achievement.slug, goal: goal.slug },
            }}>
              <div className={`${styles.achievement} achievement animate__animated`} key={i}>
                <h4>{goal.name}</h4>
                <ProgressBar percent={calculateProgress(i) / goal.steps.length} />
              </div>
            </Link>
          })}
          <div>
          </div>
        </div>
      </div>
    </div>
  </Page>
}

export default Achievement
