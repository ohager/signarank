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
    const leaderboardPromise = prisma.$queryRaw<Row[]>`
        SELECT address, score, progress,
               (RANK() OVER (ORDER BY score DESC))::int AS ranking
        FROM "Address"
        WHERE active = true
        ORDER BY score DESC
        LIMIT 10
    `;
    const latestScoresPromise = prisma.$queryRaw<Row[]>`
        SELECT address, score, progress, ranking FROM (
            SELECT address, score, progress, "updatedAt",
                   (RANK() OVER (ORDER BY score DESC))::int AS ranking
            FROM "Address"
            WHERE active = true
        ) sub
        ORDER BY "updatedAt" DESC
        LIMIT 10
    `;

    const [leaderboard, latestScores] = await Promise.all([
        leaderboardPromise,
        latestScoresPromise
    ])

    return {
        leaderboard: leaderboard.map(decorate),
        latestScores: latestScores.map(decorate)
    }
}
