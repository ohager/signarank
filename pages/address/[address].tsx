import {useRouter} from 'next/router'
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
import {getExplorerBaseUrl} from '@lib/explorerUrl';

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
    explorerBaseUrl?: string
}

const Address = ({address, score, rank, progress, error, name, explorerBaseUrl}: AddressProps) => {
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
    const addressExplorerUrl = `${explorerBaseUrl}/address/${address}`

    return <Page title={`${displayAddress} - SIGNARank`}>
        <div className="content">
            <div className="text-center items-center w-[90%] mx-auto mb-10 relative overflow-hidden h-10 [&_h2]:p-2.5 [&_h2]:inline">
                <h2 className="gradient-box gradient-bottom-only">{name || displayAddress}</h2>
                <a className="explorer-link" href={addressExplorerUrl} target="_blank" rel="noreferrer noopener">🌐</a>
            </div>
            <Score score={score} rank={rank}/>

            <div>
                <h3>Achievements</h3>
                <div className="grid grid-cols-[48%_48%] text-center gap-y-[30px] gap-x-[6%] justify-items-center box-content max-sm:grid-cols-1">
                    {achievements.map((achievement, i) => {
                        const goals = achievement.goals;
                        const percentages = goals.map((goal, j) => {
                            return calculateProgress(i, j) / goal.steps.length
                        }).reduce((partial_sum, a) => partial_sum + a, 0)
                        return <Link key={i} href={{
                            pathname: '/address/[address]/[achievement]',
                            query: {address, achievement: achievement.slug},
                        }}>
                            <div className="cursor-pointer border border-[var(--main-color3)] p-2.5 text-left shadow-[-5px_-5px_0_0_var(--main-color3)] w-full achievement animate__animated [&_h4]:m-[0_0_20px_0] [&_h4]:text-2xl [&_h4]:uppercase [&_h4]:font-normal">
                                <h4>{achievement.name}</h4>
                                <ProgressBar percent={percentages / achievement.goals.length}/>
                            </div>
                        </Link>
                    })}
                </div>
            </div>

            <div className="grid grid-cols-[50%_50%] text-center gap-y-[30px] gap-x-0 justify-items-center box-content mt-[30px] max-sm:grid-cols-1">
                <div className="w-full text-left">
                    <h3>Stats</h3>
                    <div>
                        {categoryData.map((category, i) => {
                            return <div key={i}>
                                <h4>{category.category}</h4>
                                <ProgressBar percent={category.percentCompleted}/>
                            </div>
                        })}
                    </div>
                </div>
                <div className="w-full text-left">
                    <Radar data={data} options={config}/>
                </div>
            </div>
        </div>
    </Page>
}

export default Address
