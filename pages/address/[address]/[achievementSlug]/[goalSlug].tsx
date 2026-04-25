import {useRouter} from 'next/router'
import achievements from '@lib/achievements.signa.json';
import {AddressProps} from "../index"
import ProgressBar from '@components/ProgressBar';
import Score from '@components/Score';
import {GetStaticProps, GetStaticPaths} from 'next';
import Page from '@components/Page';
import {useReedSolomonAddress} from '@hooks/useReedSolomonAddress';
import {useCallback} from 'react';
import {calculateScore} from '@api/score/calculateSignaScore';
import {singleQueryString} from '@lib/singleQueryString';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';

export const getStaticPaths: GetStaticPaths = async () => {
    return {
        paths: [],
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

    return (
        <Page title={`${displayAddress} - SIGNArank`}>
            <div className="content-area">
                {/* Profile Header */}
                <div className="glass-static p-6 mb-6 text-center">
                    <h1
                        className="text-[1.4rem] font-semibold tracking-wide mb-2"
                        style={{fontFamily: "'Cinzel', serif", color: 'var(--text)'}}
                    >
                        {displayAddress}
                    </h1>
                </div>

                <Score score={score} rank={rank}/>

                {/* Breadcrumbs */}
                <ul className="breadcrumbs">
                    <li><a href={`/address/${address}/`}>{displayAddress}</a></li>
                    <li><a href={`/address/${address}/${achievement.slug}/`}>{achievement.name}</a></li>
                    <li className="on">{goal.name}</li>
                </ul>

                {/* Goal Title */}
                <div className="section-label">{goal && goal.name}</div>

                {/* Steps */}
                <div className="glass-static p-6">
                    <div className="flex flex-col gap-6">
                        {goal && goal.steps.map((step, i) => {
                            const percent = calculateProgress(i) / 1;
                            return (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-2.5">
                                        <h3
                                            className="text-[0.85rem] font-medium text-[var(--text)]"
                                            style={{fontFamily: "'Cormorant Garamond', serif"}}
                                        >
                                            {step.name}
                                        </h3>
                                        <span
                                            className="text-[0.65rem] min-w-[48px] text-right"
                                            style={{
                                                fontFamily: "'IBM Plex Mono', monospace",
                                                color: percent >= 1 ? 'var(--gold)' : 'var(--text-faint)'
                                            }}
                                        >
                                            {percent >= 1 ? 'Done' : 'Pending'}
                                        </span>
                                    </div>
                                    <ProgressBar percent={percent}/>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Page>
    );
}

export default Goal
