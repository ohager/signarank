import {useRouter} from 'next/router'
import achievements from '@lib/achievements.signa.json';
import Link from 'next/link';
import ProgressBar from '@components/ProgressBar';
import Score from '@components/Score';
import {useEffect} from 'react';
import {GetStaticProps, GetStaticPaths} from 'next';
import 'chart.js/auto';
import {Radar} from 'react-chartjs-2';
import Page from '@components/Page';
import {calculateScore} from '@api/score/calculateSignaScore';
import {useReedSolomonAddress} from '@hooks/useReedSolomonAddress';
import {singleQueryString} from '@lib/singleQueryString';
import {prisma} from '@lib/prisma';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';
import {getExplorerBaseUrl} from '@lib/construct/constants';

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
        props: {
            ...result.props,
            explorerBaseUrl: getExplorerBaseUrl(),
        },
        revalidate: ISR_REVALIDATE_SECONDS
    };
}

export interface AddressProps {
    address: string,
    score: number,
    rank: number,
    progress: Array<string>,
    error: boolean | string,
    name?: string,
    title?: string,
    categoryScores?: Record<string, number>,
    explorerBaseUrl?: string
}

const Index = ({address, score, rank, progress, error, name, title, explorerBaseUrl}: AddressProps) => {
    const router = useRouter()
    const displayAddress = useReedSolomonAddress(address)

    useEffect(() => {
        if (error) {
            router.push('/error');
        }
    });

    const calculateProgress = function (achievementIndex: number, i: number) {
        const results = progress.filter((item: string) => {
            return item[0] === achievementIndex.toString() && item[1] === i.toString() && item.length === 3
        });

        if (results && results.length) {
            return results.length;
        } else return 0;
    };

    // TODO: calculate using points rather than percentage completed, normalize against one another maybe
    const getPercentCategoryCompleted = function (category: string) {
        const percentCompleted = achievements
            .map((achievement, i) => {

                let numberOfGoalsInThisCategoryForThisAchievement = 0;
                const goalsInThisCategory = achievement.goals
                    .map((goal, j) => {
                        const percent = progress.filter((item: string) => {
                            return item[0] === i.toString() && item[1] === j.toString() && item.length === 3
                        }).length / achievement.goals.length
                        return {
                            category: goal.category,
                            percent
                        }
                    })
                    .filter((goal) => {
                        return goal.category === category
                    });
                const percentDoneInThisAchievement = goalsInThisCategory.reduce((prev, {percent}) => {
                    return prev + percent
                }, 0);
                numberOfGoalsInThisCategoryForThisAchievement += goalsInThisCategory.length;
                return {
                    numberOfGoalsInThisCategoryForThisAchievement,
                    percentCompleted: percentDoneInThisAchievement || 0
                };
            })
            .reduce((prev, achievement) => {
                return {
                    percentCompleted: prev.percentCompleted + achievement.percentCompleted,
                    numberOfGoalsInThisCategoryForThisAchievement: prev.numberOfGoalsInThisCategoryForThisAchievement + achievement.numberOfGoalsInThisCategoryForThisAchievement
                }
            }, {
                percentCompleted: 0,
                numberOfGoalsInThisCategoryForThisAchievement: 0
            })

        return percentCompleted.percentCompleted / percentCompleted.numberOfGoalsInThisCategoryForThisAchievement
    }

    if (!name?.length) {
        name = undefined
    }

    const categories = [
        'social',
        'finance',
        'collecting',
        'technology',
        'gaming'];

    const categoryData = categories.map((category, i) => {
        const percentCompleted = getPercentCategoryCompleted(category);
        return {
            category,
            percentCompleted
        }
    });

    const data = {
        labels: categories.map(category => category.toUpperCase()),
        datasets: [{
            data: categoryData.map(({percentCompleted}) => percentCompleted * 100),
            fill: true,
            backgroundColor: 'rgba(197, 164, 78, 0.25)',
            borderColor: '#c5a44e',
            borderWidth: 2,
            pointBackgroundColor: '#e8c85a',
            pointBorderColor: '#c5a44e',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointHoverBackgroundColor: '#e8c85a',
            pointHoverBorderColor: '#ffffff'
        }]
    };

    const config = {
        layout: {
            padding: {
                left: 20,
                right: 20,
                top: 10,
                bottom: 10,
            }
        },
        scales: {
            r: {
                suggestedMin: 0,
                suggestedMax: 100,
                ticks: {
                    stepSize: 20,
                    showLabelBackdrop: false,
                    color: 'rgba(240, 236, 224, 0.5)',
                    font: {
                        family: "'IBM Plex Mono', monospace",
                        size: 9,
                    }
                },
                angleLines: {
                    color: 'rgba(255, 255, 255, 0.15)',
                    lineWidth: 1
                },
                grid: {
                    color: 'rgba(255, 255, 255, 0.12)',
                    circular: true
                },
                pointLabels: {
                    color: '#f0ece0',
                    font: {
                        family: "'Cinzel', serif",
                        size: 11,
                        weight: '600' as const
                    },
                    padding: 18
                }
            }
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(6, 4, 10, 0.9)',
                titleColor: '#e8c85a',
                bodyColor: '#f0ece0',
                borderColor: 'rgba(197, 164, 78, 0.3)',
                borderWidth: 1,
                titleFont: { family: "'Cinzel', serif" },
                bodyFont: { family: "'IBM Plex Mono', monospace" },
            }
        }
    };
    const addressExplorerUrl = `${explorerBaseUrl}/address/${address}`

    return (
        <Page title={`${displayAddress} - SIGNARank`}>
            <div className="content-area">
                {/* Profile Header */}
                <div className="glass-static p-8 mb-8 text-center">
                    <h1
                        className="text-[1.6rem] font-semibold tracking-wide mb-2"
                        style={{fontFamily: "'Cinzel', serif", color: 'var(--text)'}}
                    >
                        {name || 'Account Profile'}
                    </h1>
                    {title && (
                        <div
                            className="text-[0.78rem] tracking-[0.22em] uppercase mb-2"
                            style={{
                                fontFamily: "'Cinzel', serif",
                                color: 'var(--gold-bright)',
                                letterSpacing: '0.22em'
                            }}
                        >
                            {title}
                        </div>
                    )}
                    <div className="flex items-center justify-center gap-3">
                        <span
                            className="text-[0.85rem] text-[var(--text-dim)]"
                            style={{fontFamily: "'IBM Plex Mono', monospace"}}
                        >
                            {displayAddress}
                        </span>
                        <a
                            href={addressExplorerUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="opacity-50 hover:opacity-100 transition-opacity text-sm"
                            title="Open in Explorer"
                        >
                            &#127760;
                        </a>
                    </div>
                    {rank <= 3 && (
                        <div className="mt-3">
                            <span
                                className="inline-block px-4 py-1.5 rounded-full text-[0.7rem] font-semibold tracking-widest uppercase"
                                style={{
                                    fontFamily: "'IBM Plex Mono', monospace",
                                    background: rank === 1 ? 'linear-gradient(135deg, rgba(197,164,78,0.2), rgba(232,200,90,0.1))' : rank === 2 ? 'rgba(192,192,192,0.15)' : 'rgba(205,127,50,0.15)',
                                    border: `1px solid ${rank === 1 ? 'var(--gold-dim)' : rank === 2 ? 'rgba(192,192,192,0.3)' : 'rgba(205,127,50,0.3)'}`,
                                    color: rank === 1 ? 'var(--gold-bright)' : rank === 2 ? '#c0c0c0' : '#cd7f32'
                                }}
                            >
                                {rank === 1 ? 'Champion' : rank === 2 ? 'Runner-Up' : 'Third Place'}
                            </span>
                        </div>
                    )}
                </div>

                <Score score={score} rank={rank}/>

                {/* Achievements */}
                <div className="section-label">Achievements</div>
                <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1 mb-10">
                    {achievements.map((achievement, i) => {
                        const goals = achievement.goals;
                        const percentages = goals.map((goal, j) => {
                            return calculateProgress(i, j) / goal.steps.length
                        }).reduce((partial_sum, a) => partial_sum + a, 0)
                        const percent = percentages / achievement.goals.length;

                        return (
                            <Link key={i} href={{
                                pathname: '/address/[address]/[achievement]',
                                query: {address, achievement: achievement.slug},
                            }}>
                                <div className="glass-static p-5 cursor-pointer transition-all hover:border-[var(--glass-border-hover)] hover:bg-[rgba(255,255,255,0.02)] h-full">
                                    <h3
                                        className="text-[0.95rem] font-semibold tracking-[0.08em] uppercase mb-4 text-[var(--text)]"
                                        style={{fontFamily: "'Cinzel', serif"}}
                                    >
                                        {achievement.name}
                                    </h3>
                                    <div className="flex items-center gap-3 mb-2">
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

                {/* Stats + Radar */}
                <div className="section-label">Category Breakdown</div>
                <div className="grid grid-cols-2 gap-6 max-sm:grid-cols-1">
                    <div className="glass-static p-6">
                        <h3
                            className="text-[0.75rem] font-semibold tracking-[0.15em] uppercase mb-5 text-[var(--text-dim)]"
                            style={{fontFamily: "'Cinzel', serif"}}
                        >
                            Stats
                        </h3>
                        <div className="flex flex-col gap-5">
                            {categoryData.map((category, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span
                                            className="text-[0.75rem] capitalize text-[var(--text-dim)]"
                                            style={{fontFamily: "'Cormorant Garamond', serif", fontWeight: 500}}
                                        >
                                            {category.category}
                                        </span>
                                        <span
                                            className="text-[0.65rem] text-[var(--text-faint)]"
                                            style={{fontFamily: "'IBM Plex Mono', monospace"}}
                                        >
                                            {Math.round(category.percentCompleted * 100)}%
                                        </span>
                                    </div>
                                    <ProgressBar percent={category.percentCompleted}/>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="glass-static p-6">
                        <Radar data={data} options={config}/>
                    </div>
                </div>
            </div>
        </Page>
    );
}

export default Index
