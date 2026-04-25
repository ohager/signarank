import {prisma} from '@lib/prisma';
import {getCategoryScoresFromProgress, getTitle} from '@lib/titles';

type Row = {
    address: string;
    score: number;
    progress: string;
    ranking: number;
};

function decorate(row: Row) {
    let parsed: string[] = [];
    try {
        parsed = JSON.parse(row.progress || '[]');
    } catch {
        parsed = [];
    }
    const categoryScores = getCategoryScoresFromProgress(parsed);
    const title = getTitle(categoryScores, row.ranking, row.address);
    return {
        address: row.address,
        score: row.score,
        rank: row.ranking,
        title
    };
}

export async function fetchLeaderboard() {
    const leaderboardPromise = prisma.address.findMany({
        take: 10,
        select: {
            address: true,
            score: true,
            progress: true,
            ranking: true
        },
        where: {
            active: true
        },
        orderBy: {
            score: 'desc'
        }
    });
    const latestScoresPromise = prisma.address.findMany({
        take: 10,
        select: {
            address: true,
            score: true,
            progress: true,
            ranking: true
        },
        where: {
            active: true
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });

    const [leaderboard, latestScores] = await Promise.all([
        leaderboardPromise,
        latestScoresPromise
    ])

    return {
        leaderboard: leaderboard.map(decorate),
        latestScores: latestScores.map(decorate)
    }
}
