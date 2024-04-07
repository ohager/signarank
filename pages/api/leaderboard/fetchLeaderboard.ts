import {prisma} from '@lib/prisma';

export async function fetchLeaderboard() {
    const leaderboardPromise = prisma.address.findMany({
        take: 10,
        select: {
            address: true,
            score: true
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
            score: true
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
        leaderboard,
        latestScores
    }
}
