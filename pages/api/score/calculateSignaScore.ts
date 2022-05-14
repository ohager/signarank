import achievements from '@lib/achievements.signa.json';
import {prisma} from '@lib/prisma';

import {
    Address,
    LedgerClientFactory,
    TransactionArbitrarySubtype,
    TransactionPaymentSubtype,
    TransactionType
} from '@signumjs/core';
import {ExceptionInvalidAddress} from './exceptionInvalidAddress';
import {ExceptionInactiveAccount} from './exceptionInactiveAccount';
import {Amount} from '@signumjs/util';
import {NftService} from './nftService';

async function fetchCachedAddress(accountId: string) {
    const cacheAddress = await prisma.address.findFirst({
        where: {
            address: accountId
        }
    });

    if (cacheAddress && !cacheAddress.active) {
        throw new ExceptionInactiveAccount(accountId)
    }

    const Minutes = 60 * 1000
    const CacheExpiresAfter = 30 * Minutes
    const cacheHit = cacheAddress && cacheAddress.updatedAt > new Date(new Date().getTime() - CacheExpiresAfter) && !process.env.DEVELOPMENT

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

const nftService = new NftService({
        hostUrl: process.env.NEXT_SERVER_NFT_SERVICE_API_HOST || "",
        apiKey: process.env.NEXT_SERVER_NFT_SERVICE_API_KEY || ""
    }
)

export async function calculateScore(accountId: string) {
    let score = 0, rank = 0;
    let totalPointsPossible = 0;
    let completedAchievements = 0;
    let progress: Array<string> = []; // list of completed steps, goals, achievements
    let sentTransactions = [];
    let receivedTransactions = [];
    let sentMultiouts = [];
    let receivedMessages = [];
    let sentMessages = [];
    let cached = false;
    let error = false;
    let name = '';
    try {

        assertValidAccountAddress(accountId);
        const {cacheAddress, cacheHit} = await fetchCachedAddress(accountId);

        if (cacheHit && cacheAddress) {
            progress = JSON.parse(cacheAddress.progress);
            score = cacheAddress.score;
            name = cacheAddress.name;
            cached = true;
        }


        if (!cached || process.env.DEVELOPMENT) {

            const [transactionList, blockList, account, accountAliases, contracts, nftCount] = await Promise.all([
                ledger.account.getAccountTransactions({accountId, includeIndirect: true}),
                ledger.account.getAccountBlocks({accountId, includeTransactions: false}),
                ledger.account.getAccount({accountId, includeCommittedAmount: true}),
                ledger.account.getAliases(accountId),
                ledger.contract.getContractsByAccount({accountId}),
                nftService.getNftCountPerAccount(accountId)
            ])


            const aliasCount = accountAliases.aliases ? accountAliases.aliases.length : 0
            const tokenCount = account.assetBalances ? account.assetBalances.length : 0
            const balance = Amount.fromPlanck(account.balanceNQT)
            const transactions = transactionList.transactions
            const blocksMined = blockList.blocks ? blockList.blocks.length : 0
            const commitmentPercentage = Amount.fromPlanck(account.committedBalanceNQT).getRaw().div(balance.getRaw()).times(100)
            const contractHashIds = contracts.ats.reduce((acc, c) => {
                acc[c.machineCodeHashId] = 1
                return acc;
            }, {} as any)
            const differentContractCount = Object.keys(contractHashIds).length


            const markStepCompleted = (j: any = '', k: any = '', l: any = '') => {
                progress.push(`${j}${k}${l}`);
            };

            const isComplete = (j: any = '', k: any = '', l: any = '') => {
                return progress.indexOf(`${j}${k}${l}`) > -1;
            };

            // THE LOOP - we are only going to loop through all transactions ONCE,
            // so do whatever you need to do in here and before/after.
            // TODO: refactor using a strategy pattern like thingy
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
                                                        markStepCompleted(j, k, l);
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
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                }
                                                break;
                                            case 'send_signa_amount':
                                                // @ts-ignore
                                                address = step.params.address || accountId;
                                                if (transactions[i].recipient !== address) {
                                                    // @ts-ignore
                                                    if ((transactions[i].amountNQT / 1E8) >= step.params.amount) {
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                }
                                                break;
                                            case 'own_token_count':
                                                // We only want to tally this once since we are inside THE LOOP
                                                runOnlyOnce(i, () => {
                                                    // @ts-ignore
                                                    if (tokenCount >= step.params.count) {
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                })
                                                break;
                                            case 'own_signum_art_nft':
                                                // We only want to tally this once since we are inside THE LOOP
                                                runOnlyOnce(i, () => {
                                                    // @ts-ignore
                                                    if (nftCount >= step.params.count) {
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                })
                                                break;
                                            case 'own_alias':
                                                // We only want to tally this once since we are inside THE LOOP
                                                runOnlyOnce(i, () => {
                                                    // @ts-ignore
                                                    if (aliasCount >= step.params.count) {
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                })
                                                break;
                                            case 'mine_blocks_count':
                                                // We only want to tally this once since we are inside THE LOOP
                                                runOnlyOnce(i, () => {
                                                    // @ts-ignore
                                                    if (blocksMined >= step.params.count) {
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                })
                                                break;
                                            case 'commitment_count':
                                                // We only want to tally this once since we are inside THE LOOP
                                                runOnlyOnce(i, () => {
                                                    // @ts-ignore
                                                    if (commitmentPercentage >= step.params.percent) {
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                })
                                                break;
                                            case 'snr_rewarded':
                                                // @ts-ignore
                                                if (transactions[i].sender === step.params.sender) {
                                                    markStepCompleted(j, k, l);
                                                    score += step.points;
                                                }
                                                break;
                                            case 'multiout_payments_count':

                                                // @ts-ignore
                                                address = step.params.address || accountId;
                                                if (transactions[i].sender === address &&
                                                    transactions[i].type === TransactionType.Payment &&
                                                    transactions[i].subtype !== TransactionPaymentSubtype.Ordinary
                                                ) {
                                                    if (!sentMultiouts[j]) {
                                                        sentMultiouts[j] = [] as Array<Array<number>>;
                                                    }
                                                    if (!sentMultiouts[j][k]) {
                                                        sentMultiouts[j][k] = [];
                                                    }
                                                    if (!sentMultiouts[j][k][l]) {
                                                        sentMultiouts[j][k][l] = 0;
                                                    }
                                                    sentMultiouts[j][k][l]++;
                                                    // @ts-ignore
                                                    if (sentMultiouts[j][k][l] === step.params.count) {
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                }
                                                break;
                                            case 'receive_message_count':

                                                // @ts-ignore
                                                address = step.params.address || accountId;
                                                if (transactions[i].type === TransactionType.Arbitrary &&
                                                    transactions[i].subtype === TransactionArbitrarySubtype.Message &&
                                                    transactions[i].recipient === address
                                                ) {
                                                    if (!receivedMessages[j]) {
                                                        receivedMessages[j] = [] as Array<Array<number>>;
                                                    }
                                                    if (!receivedMessages[j][k]) {
                                                        receivedMessages[j][k] = [];
                                                    }
                                                    if (!receivedMessages[j][k][l]) {
                                                        receivedMessages[j][k][l] = 0;
                                                    }
                                                    receivedMessages[j][k][l]++;
                                                    // @ts-ignore
                                                    if (receivedMessages[j][k][l] === step.params.count) {
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                }
                                                break;
                                            case 'send_message_count':

                                                // @ts-ignore
                                                address = step.params.address || accountId;
                                                if (
                                                    transactions[i].type === TransactionType.Arbitrary &&
                                                    transactions[i].subtype === TransactionArbitrarySubtype.Message &&
                                                    transactions[i].sender === address
                                                ) {
                                                    if (!sentMessages[j]) {
                                                        sentMessages[j] = [] as Array<Array<number>>;
                                                    }
                                                    if (!sentMessages[j][k]) {
                                                        sentMessages[j][k] = [];
                                                    }
                                                    if (!sentMessages[j][k][l]) {
                                                        sentMessages[j][k][l] = 0;
                                                    }
                                                    sentMessages[j][k][l]++;
                                                    // @ts-ignore
                                                    if (sentMessages[j][k][l] === step.params.count) {
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                }
                                                break;
                                            case 'donated_to_sna':
                                                // @ts-ignore
                                                if (transactions[i].recipient === step.params.receiver && (transactions[i].amountNQT / 1E8) >= step.params.amount) {
                                                    markStepCompleted(j, k, l);
                                                    score += step.points;
                                                }
                                                break;
                                            case 'create_contract':
                                                // We only want to tally this once since we are inside THE LOOP
                                                runOnlyOnce(i, () => {
                                                    // @ts-ignore
                                                    if (differentContractCount >= step.params.count) {
                                                        markStepCompleted(j, k, l);
                                                        score += step.points;
                                                    }
                                                })
                                                break;
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
        rank = higherRankedAddresses || 0;
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
    } catch (e: any) {
        console.error('calculateSignaScore', e)
        return {
            props: {
                address: accountId,
                score: -1,
                rank: -1,
                progress: [],
                error: e.message,
                name: ''
            }
        }
    }
}
