import {useRouter} from 'next/router'
import styles from '../../styles/Address.module.scss'
import achievements from '@lib/achievements.signa.json';
import Link from 'next/link';
import ProgressBar from '../../components/ProgressBar';
import Score from '../../components/Score';
import {useEffect} from 'react';
import {GetStaticProps, GetStaticPaths} from 'next';
import 'chart.js/auto';
import {Radar} from 'react-chartjs-2';
import Page from '../../components/Page';
import {calculateScore} from '../api/score/calculateSignaScore';
import {useReedSolomonAddress} from '@hooks/useReedSolomonAddress';
import {singleQueryString} from '@lib/singleQueryString';
import {prisma} from '@lib/prisma';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';
import * as process from 'process';

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
        revalidate: ISR_REVALIDATE_SECONDS  // Matches database cache TTL (configurable via CACHE_TTL_SECONDS env var)
    };
}

export interface AddressProps {
    address: string,
    score: number,
    rank: number,
    progress: Array<string>,
    error: boolean | string,
    name?: string
}

const Address = ({address, score, rank, progress, error, name}: AddressProps) => {
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
        'technology'];

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
            backgroundColor: '#D9048E',
            borderColor: '#ffffff',
            pointBackgroundColor: '#D9048E',
            pointBorderColor: '#D9048E',
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#D9048E'
        }]
    };

    const config = {
        type: 'radar',
        data: data,
        scales: {
            r: {
                // suggestedMin: 0,
                // suggestedMax: 100,
                ticks: {
                    stepSize: 20,
                    showLabelBackdrop: false
                },
                angleLines: {
                    color: "rgba(255, 255, 255, 1)",
                    lineWidth: 1
                },
                gridLines: {
                    color: "rgba(255, 255, 255, 1)",
                    circular: true
                },
                grid: {
                    borderColor: 'rgba(255, 255, 255, .25)',
                    backgroundColor: 'rgba(255, 255, 255, .25)',
                    color: 'rgba(255, 255, 255, .25)'
                }
            }
        },
        plugins: {
            legend: {
                display: false
            }
        }
    };
    const addressExplorerUrl = `${process.env.NEXT_PUBLIC_SIGNUM_EXPLORER}/address/${address}`

    return <Page title={`${displayAddress} - SIGNARank`}>
        <div className="content">
            <div className={styles.address}>
                <h2 className="gradient-box gradient-bottom-only">{name || displayAddress}</h2>
                <a className="explorer-link" href={addressExplorerUrl} target="_blank" rel="noreferrer noopener">🌐</a>
            </div>
            <Score score={score} rank={rank}/>

            <div>
                <h3>Achievements</h3>
                <div className={`${styles.cellParent} ${styles.achivements}`}>
                    {achievements.map((achievement, i) => {
                        const goals = achievement.goals;
                        const percentages = goals.map((goal, j) => {
                            return calculateProgress(i, j) / goal.steps.length
                        }).reduce((partial_sum, a) => partial_sum + a, 0)
                        return <Link key={i} href={{
                            pathname: '/address/[address]/[achievement]',
                            query: {address, achievement: achievement.slug},
                        }}>
                            <div className={`${styles.achievement} achievement animate__animated`}>
                                <h4>{achievement.name}</h4>
                                <ProgressBar percent={percentages / achievement.goals.length}/>
                            </div>
                        </Link>
                    })}
                </div>
            </div>

            <div className={styles.categoryRow}>
                <div className={styles.stats}>
                    <h3>Stats</h3>
                    <div className={styles.categories}>
                        {categoryData.map((category, i) => {
                            return <div
                                key={i}
                                className={`${styles.category}`}>
                                <h4>{category.category}</h4>
                                <ProgressBar percent={category.percentCompleted}/>
                            </div>
                        })}
                    </div>
                </div>
                <div className={styles.radar}>
                    <Radar data={data} options={config}/>
                </div>
            </div>
        </div>
    </Page>
}

export default Address
