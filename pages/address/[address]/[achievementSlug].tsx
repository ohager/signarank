import {useRouter} from 'next/router'
import achievements from '@lib/achievements.signa.json';
import Link from 'next/link';
import {AddressProps} from "../[address]"
import ProgressBar from '../../../components/ProgressBar';
import Score from '../../../components/Score';
import {GetStaticProps, GetStaticPaths} from 'next';
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

const Achievement = ({score, rank, progress, name, address}: AddressProps) => {

    const router = useRouter()
    const {achievementSlug} = router.query;

    const displayAddress = useReedSolomonAddress(address)
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

    return (
        <Page title={`${displayAddress} - SIGNArank`}>
            <div className="content-area">
                {/* Profile Header */}
                <div className="glass-static p-6 mb-6 text-center">
                    <h1
                        className="text-[1.4rem] font-semibold tracking-wide mb-2"
                        style={{fontFamily: "'Cinzel', serif", color: 'var(--text)'}}
                    >
                        {name || displayAddress}
                    </h1>
                </div>

                <Score score={score} rank={rank}/>

                {/* Breadcrumbs */}
                <ul className="breadcrumbs">
                    <li><a href={`/address/${address}/`}>{displayAddress}</a></li>
                    <li className="on">{achievement.name}</li>
                </ul>

                {/* Achievement Title */}
                <div className="section-label">{achievement && achievement.name}</div>

                {/* Goals Grid */}
                <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
                    {achievement && achievement.goals.map((goal, i) => {
                        const percent = calculateProgress(i) / goal.steps.length;
                        return (
                            <Link key={i} href={{
                                pathname: '/address/[address]/[achievement]/[goal]',
                                query: {address, achievement: achievement.slug, goal: goal.slug},
                            }}>
                                <div className="glass-static p-5 cursor-pointer transition-all hover:border-[var(--glass-border-hover)] hover:bg-[rgba(255,255,255,0.02)] h-full">
                                    <h3
                                        className="text-[0.9rem] font-semibold tracking-[0.08em] uppercase mb-4 text-[var(--text)]"
                                        style={{fontFamily: "'Cinzel', serif"}}
                                    >
                                        {goal.name}
                                    </h3>
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className="flex-1">
                                            <ProgressBar percent={percent}/>
                                        </div>
                                        <span
                                            className="text-[0.7rem] text-[var(--text-faint)] min-w-[40px] text-right"
                                            style={{fontFamily: "'IBM Plex Mono', monospace"}}
                                        >
                                            {Math.round(percent * 100)}%
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </Page>
    );
}

export default Achievement
