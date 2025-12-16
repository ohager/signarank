import {useRouter} from 'next/router'
import styles from '@styles/Address.module.scss'
import goalStyles from '@styles/Goal.module.scss'
import achievements from '@lib/achievements.signa.json';
import {AddressProps} from "../../[address]"
import ProgressBar from '@components/ProgressBar';
import Score from '@components/Score';
import {GetStaticProps, GetStaticPaths} from 'next';
import Page from '@components/Page';
import {useReedSolomonAddress} from '@hooks/useReedSolomonAddress';
import {useCallback} from 'react';
import {calculateScore} from '../../../api/score/calculateSignaScore';
import {singleQueryString} from '@lib/singleQueryString';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';

// Generate on-demand with ISR (fallback: blocking)
// Pre-generating all address+achievement+goal combinations would be too many paths
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

const Goal = ({score, rank, progress, address}: AddressProps) => {

    const router = useRouter()
    const {achievementSlug, goalSlug} = router.query;
    const displayAddress = useReedSolomonAddress(address)

    const achievementIndex = achievements.findIndex((potentialMatch) => {
        return potentialMatch.slug === achievementSlug as string;
    })

    const achievement = achievements[achievementIndex];

    const goalIndex = achievement.goals.findIndex((potentialMatch) => {
        return potentialMatch.slug === goalSlug as string;
    })
    const goal = achievement.goals[goalIndex];

    const calculateProgress = useCallback((i: number) => {
        const results = progress.filter((item) => {
            return item[0] === achievementIndex.toString() && item[1] === goalIndex.toString() && item[2] === i.toString()
        });
        return results && results.length ? results.length : 0;
    }, [progress]);

    return <Page title={`${displayAddress} - SIGNArank`}>
        <div className="content">
            <div className={styles.address}>
                <h2 className="gradient-box gradient-bottom-only">{displayAddress}</h2>
            </div>
            <Score score={score} rank={rank}/>
            <div>
                <ul className="breadcrumbs">
                    <li><a href={`/address/${address}/`}>{displayAddress}</a></li>
                    <li><a href={`/address/${address}/${achievement.slug}/`}>{achievement.name}</a></li>
                    <li className="on">{goal.name}</li>
                </ul>
                <h3>{goal && goal.name}</h3>
                <div className={goalStyles.list}>
                    {goal && goal.steps.map((step, i) => {
                        return <div className={`${styles.step} animate__animated`} key={i}>
                            <h4>{step.name}</h4>
                            <ProgressBar percent={calculateProgress(i) / 1}/>
                        </div>
                    })}
                    <div>
                    </div>
                </div>
            </div>
        </div>
    </Page>
}

export default Goal
