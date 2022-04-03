import achievements from '@lib/achievements.signa.json';
import {PrismaClient} from '@prisma/client';
import {Address, LedgerClientFactory} from '@signumjs/core';
import {ExceptionInvalidAddress} from './exceptionInvalidAddress';
import {ExceptionInactiveAccount} from './exceptionInactiveAccount';
import {Amount} from '@signumjs/util';


const prisma = new PrismaClient()

async function fetchCachedAddress(accountId: string) {
    const cacheAddress = await prisma.address.findFirst({
        where: {
            address: accountId
        }
    });

    if (cacheAddress && !cacheAddress.active) {
        throw new ExceptionInactiveAccount(accountId)
    }

    const cacheHit = cacheAddress && cacheAddress.updatedAt > new Date(new Date().getTime() - (24 * 60 * 60 * 1000)) && !process.env.DEVELOPMENT

    return {
        cacheAddress,
        cacheHit: cacheHit && cacheAddress
    }
}


function assertValidAccountAddress(address: string): string {
    try {
        return Address.create(address).getNumericId()
    } catch (e) {
        throw new ExceptionInvalidAddress(address)
    }
}

const toStringArray = (csv: any = ""): Array<string> => csv.split(",");

const runOnlyOnce = (i: number, fn: () => void) => {
    if (i === 0) {
        fn()
    }
}

const ledger = LedgerClientFactory.createClient({
    nodeHost: process.env.NEXT_PUBLIC_SIGNUM_DEFAULT_NODE || "",
    reliableNodeHosts: toStringArray(process.env.NEXT_PUBLIC_SIGNUM_RELIABLE_NODES)
})

export async function calculateScore(accountId: string) {
    let score = 0, rank = 0;
    let totalPointsPossible = 0;
    let completedAchievements = 0;
    let gasSpent = 0;
    let progress: Array<string> = []; // list of completed steps, goals, achievements

    let sentTransactions = [];
    let receivedTransactions = [];
    let ownedTokens = [];
    let cached = false;
    let error = false;
    let name = '';

    assertValidAccountAddress(accountId);
    const {cacheAddress, cacheHit} = await fetchCachedAddress(accountId);

    if (cacheHit && cacheAddress) {
        progress = JSON.parse(cacheAddress.progress);
        score = cacheAddress.score;
        name = cacheAddress.name;
        cached = true;
    }


    if (!cached || process.env.DEVELOPMENT) {
        const [transactionList, blockList, account] = await Promise.all([
            ledger.account.getAccountTransactions({accountId, includeIndirect: true}),
            ledger.account.getAccountBlocks({accountId, includeTransactions: false}),
            ledger.account.getAccount({accountId, includeCommittedAmount: true})
        ])

        const tokenCount = account.assetBalances.length;
        const balance = Amount.fromPlanck(account.balanceNQT)
        const transactions = transactionList.transactions
        const blocksMined = blockList.blocks.length
        const commitmentPercentage = Amount.fromPlanck(account.committedBalanceNQT).getRaw().div(balance.getRaw()).times(100)

        const markStepCompleted = (j: any = '', k: any = '', l: any = '') => {
            progress.push(`${j}${k}${l}`);
        };

        const isComplete = (j: any = '', k: any = '', l: any = '') => {
            return progress.indexOf(`${j}${k}${l}`) > -1;
        };

        // THE LOOP - we are only going to loop through all transactions ONCE,
        // so do whatever you need to do in here and before/after.
        for (let i = 0; i < transactions.length; i++) {

            // SCORE = step points + goal points (if all steps complete) + achievement points (if all goals complete)
            for (let j = 0; j < achievements.length; j++) {
                const achievement = achievements[j];

                let totalPointsForThisAchievement = achievement.points;
                let completedGoalsForThisAchievement = 0;

                if (achievement.goals && !isComplete(j)) {
                    for (let k = 0; k < achievement.goals.length; k++) {
                        let goal = achievement.goals[k];
                        let completedStepsForThisGoal = 0;

                        totalPointsForThisAchievement += goal.points;
                        if (goal.steps && !isComplete(j, k)) {
                            for (let l = 0; l < goal.steps.length; l++) {
                                let address = [];
                                let step = goal.steps[l];

                                totalPointsForThisAchievement += step.points;

                                if (!isComplete(j, k, l)) {

                                    switch (step.type) {
                                        case 'transaction_to_address_count':

                                            // @ts-ignore
                                            address = step.params.address || accountId;

                                            if (transactions[i].recipient !== address) {
                                                if (!sentTransactions[j]) {
                                                    sentTransactions[j] = [] as Array<Array<number>>;
                                                }
                                                if (!sentTransactions[j][k]) {
                                                    sentTransactions[j][k] = [];
                                                }
                                                if (!sentTransactions[j][k][l]) {
                                                    sentTransactions[j][k][l] = 0;
                                                }
                                                sentTransactions[j][k][l]++;
                                                // @ts-ignore
                                                if (sentTransactions[j][k][l] === step.params.count) {
                                                    // console.log('step completed: transaction_to_address_count',   step.name, step.points, goal.name, achievement.name, transactions[i].hash)
                                                    markStepCompleted(j, k, l);
                                                    // if step is completed, include step points in score
                                                    score += step.points;
                                                }
                                            }
                                            break;

                                        case 'transaction_from_address_count':
                                            // @ts-ignore
                                            address = step.params.address || accountId;
                                            if (transactions[i].recipient === address) {
                                                if (!receivedTransactions[j]) {
                                                    receivedTransactions[j] = [] as Array<Array<number>>;
                                                }
                                                if (!receivedTransactions[j][k]) {
                                                    receivedTransactions[j][k] = [];
                                                }
                                                if (!receivedTransactions[j][k][l]) {
                                                    receivedTransactions[j][k][l] = 0;
                                                }
                                                receivedTransactions[j][k][l]++;

                                                // @ts-ignore
                                                if (receivedTransactions[j][k][l] === step.params.count) {
                                                    // console.log('step completed: transaction_from_address_count',  step.name, step.points,goal.name, achievement.name)
                                                    markStepCompleted(j, k, l);
                                                    // if step is completed, include step points in score
                                                    score += step.points;
                                                }
                                            }
                                            break;
                                        //
                                        // case 'send_eth_amount':
                                        //     const amountSent = parseFloat(transactions[i].value) / Math.pow(10, 18);
                                        //     // @ts-ignore
                                        //     if (amountSent >= step.params.amount && transactions[i].contractAddress === "") { // filter out contract transactions
                                        //         // console.log('step completed: send_eth_amount', step.name, step.points, goal.name, achievement.name)
                                        //         markStepCompleted(j, k, l);
                                        //         // if step is completed, include step points in score
                                        //         score += step.points;
                                        //     }
                                        //     break;
                                        //
                                        case 'own_token_count':
                                            // We only want to tally this once since we are inside THE LOOP
                                            runOnlyOnce(i, () => {
                                                // @ts-ignore
                                                if (tokenCount >= step.params.count) {
                                                    // console.log('step completed: own_token_count', step.name, step.points, goal.name, achievement.name)
                                                    markStepCompleted(j, k, l);
                                                    // if step is completed, include step points in score
                                                    score += step.points;
                                                }
                                            })
                                        //
                                        //     break;
                                        // case 'own_poap_count':
                                        //     // We only want to tally this once since we are inside THE LOOP
                                        //     if (i === 0) {
                                        //         // @ts-ignore
                                        //         if (poaps && poaps.length >= step.params.count) {
                                        //             // console.log('step completed: own_poap_count', step.name, step.points, goal.name, achievement.name)
                                        //             markStepCompleted(j, k, l);
                                        //             // if step is completed, include step points in score
                                        //             score += step.points;
                                        //         }
                                        //     }
                                        //
                                        //     break;
                                        //
                                        case 'mine_blocks_count':
                                            // We only want to tally this once since we are inside THE LOOP
                                            runOnlyOnce(i, () => {
                                                // @ts-ignore
                                                if (blocksMined && blocksMined.length >= step.params.count) {
                                                    // console.log('step completed: mine_blocks_count', step.name, step.points, goal.name, achievement.name)
                                                    markStepCompleted(j, k, l);
                                                    // if step is completed, include step points in score
                                                    score += step.points;
                                                }
                                            })
                                            break;
                                        case 'commitment_count':
                                            // We only want to tally this once since we are inside THE LOOP
                                            runOnlyOnce(i, () => {
                                                // @ts-ignore
                                                if (commitmentPercentage >= step.params.count) {
                                                    // console.log('step completed: mine_blocks_count', step.name, step.points, goal.name, achievement.name)
                                                    markStepCompleted(j, k, l);
                                                    // if step is completed, include step points in score
                                                    score += step.points;
                                                }
                                            })
                                            break;
                                        case 'snr-rewarded':
                                            // @ts-ignore
                                            if (transactions[i].sender === step.params.sender) {
                                                // console.log('step completed: mine_blocks_count', step.name, step.points, goal.name, achievement.name)
                                                markStepCompleted(j, k, l);
                                                // if step is completed, include step points in score
                                                score += step.points;
                                            }
                                            break;
                                        //
                                        // case 'spend_gas_amount':
                                        //     // @ts-ignore
                                        //     addresses = convertToLowerCase(step.params.address || accountId);
                                        //
                                        //     if (addresses.indexOf(convertToLowerCase(transactions[i].from)) > -1 !== false) {
                                        //         gasSpent += (parseFloat(transactions[i].gasPrice) / Math.pow(10, 18) +
                                        //                 parseFloat(transactions[i].cumulativeGasUsed) / Math.pow(10, 18)) *
                                        //             parseFloat(transactions[i].gasUsed);
                                        //         const amountSpent = gasSpent;
                                        //
                                        //         // @ts-ignore
                                        //         if (amountSpent >= parseFloat(step.params.amount)) {
                                        //             // console.log('step completed: spend_gas_amount', step.name, step.points, goal.name, achievement.name, transactions[i].hash)
                                        //             markStepCompleted(j, k, l);
                                        //             // if step is completed, include step points in score
                                        //             score += step.points;
                                        //         }
                                        //     }
                                        //
                                        //     break;
                                        //
                                        // case 'own_token_by_address':
                                        //
                                        //     // @ts-ignore
                                        //     addresses = convertToLowerCase(step.params.address || accountId);
                                        //
                                        //     let tokensFound = 0;
                                        //
                                        //     // This method checks the ethplorer response and etherscan responses
                                        //     // for the best possible outcome.
                                        //     // Method 1 - ethplorer - We only want to tally this once since we are inside THE LOOP
                                        //     if (i === 0) {
                                        //         if (tokens && tokens.length) {
                                        //             for (let m = 0; m < tokens.length; m++) {
                                        //                 const token = tokens[m];
                                        //                 if (addresses.indexOf(token.tokenInfo.address) > -1 !== false) {
                                        //                     tokensFound++;
                                        //                 }
                                        //             }
                                        //         }
                                        //     }
                                        //
                                        //
                                        //     // if above method failed, try method #2 - etherscan
                                        //     if ((transactions[i].contractAddress && addresses.indexOf(convertToLowerCase(transactions[i].contractAddress)) > -1 !== false) || tokensFound) {
                                        //
                                        //         if (!ownedTokens[j]) {
                                        //             ownedTokens[j] = [] as Array<Array<number>>;
                                        //         }
                                        //         if (!ownedTokens[j][k]) {
                                        //             ownedTokens[j][k] = [];
                                        //         }
                                        //         if (!ownedTokens[j][k][l]) {
                                        //             ownedTokens[j][k][l] = tokensFound;
                                        //         }
                                        //         // if using method #2 - avoid over counting
                                        //         if (!tokensFound) {
                                        //             ownedTokens[j][k][l]++;
                                        //         }
                                        //         // @ts-ignore
                                        //         if (ownedTokens[j][k][l] === step.params.count) {
                                        //             // console.warn('step completed: own_token_by_address', step.name, step.points, goal.name, achievement.name)
                                        //             markStepCompleted(j, k, l);
                                        //             // if step is completed, include step points in score
                                        //             score += step.points;
                                        //         }
                                        //     }
                                        //
                                        //     break;


                                        default:
                                            break;
                                    }
                                }
                                for (let m = 0; m < progress.length; m++) {
                                    if (progress[m][0] === j.toString() && progress[m][1] === k.toString() && progress[m][2] === l.toString()) {
                                        completedStepsForThisGoal++;
                                    }
                                }
                                if (completedStepsForThisGoal === goal.steps.length) {
                                    // console.warn('goal completed', step.name, goal.points, goal.name, achievement.name)
                                    score += goal.points;
                                    markStepCompleted(j, k);
                                }
                            }
                        }

                        for (let p = 0; p < progress.length; p++) {
                            if (progress[p][0] === j.toString() && progress[p][1] === k.toString() && !progress[p][2]) {
                                completedGoalsForThisAchievement++;
                            }
                        }
                        // if all goals are completed, include achievement points in score
                        if (completedGoalsForThisAchievement === achievement.goals.length) {
                            score += achievement.points;
                            // console.warn('achievement completed', achievement.points, achievement.name)
                            completedAchievements++;
                            if (!isComplete(j)) {
                                markStepCompleted(j);
                            }
                        }
                    }
                }
                // We only want to tally this once since we are inside THE LOOP
                if (i === 0) {
                    totalPointsPossible += totalPointsForThisAchievement;
                }
            }
        }


        // update the cache
        const upsertObj = {
            address: accountId.toLowerCase(),
            score,
            name,
            imageUrl: '',
            description: '',
            progress: JSON.stringify(progress)
        };
        await prisma.address.upsert({
            where: {
                // @ts-ignore
                address: accountId.toLowerCase()
            },
            update: upsertObj,
            create: upsertObj
        });

    }

    const higherRankedAddresses = await prisma.address.count({
        where: {
            score: {
                gte: score,
            },
        },
    });
    if (higherRankedAddresses) {
        rank = higherRankedAddresses || 0;
    }

    return {
        props: {
            address: accountId,
            score,
            // totalPointsPossible,
            // totalTransactions: transactions.length,
            rank,
            progress,
            error,
            name
        }
    }
}
