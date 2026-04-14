import achievements from './achievements.signa.json';
import titlesConfig from './titles.signa.json';

export type CategoryScores = Record<string, number>;

export function getCategoryScoresFromProgress(progress: string[]): CategoryScores {
    const done = new Set(progress);
    const scores: CategoryScores = {};

    for (let j = 0; j < achievements.length; j++) {
        const achievement = achievements[j];
        if (!achievement.goals) continue;

        for (let k = 0; k < achievement.goals.length; k++) {
            const goal: any = achievement.goals[k];
            const category = goal.category;
            if (!category) continue;

            if (goal.steps) {
                for (let l = 0; l < goal.steps.length; l++) {
                    if (done.has(`${j}${k}${l}`)) {
                        scores[category] = (scores[category] || 0) + (goal.steps[l].points || 0);
                    }
                }
            }

            if (done.has(`${j}${k}`)) {
                scores[category] = (scores[category] || 0) + (goal.points || 0);
            }
        }
    }

    return scores;
}

function pickEpithet(rank: number, seed: string): string | null {
    if (!rank || rank < 1) return null;
    for (const e of titlesConfig.epithets) {
        if (rank <= e.maxRank) {
            if (!e.words?.length) return null;
            return pickFrom(e.words, `${seed}|epi|${e.maxRank}`);
        }
    }
    return null;
}

// djb2 — deterministic, stable across runs, good distribution for short strings
function hash(input: string): number {
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
        h = ((h << 5) + h + input.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
}

function pickFrom<T>(arr: T[], seed: string): T {
    return arr[hash(seed) % arr.length];
}

export function getTitle(categoryScores: CategoryScores, rank: number, seed: string = ''): string {
    const entries = Object.entries(categoryScores)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]);

    const epithet = pickEpithet(rank, seed);

    if (entries.length === 0) {
        return epithet ? `${epithet} ${titlesConfig.aspirant}` : titlesConfig.aspirant;
    }

    const [primaryCat, primaryScore] = entries[0];
    const primary = (titlesConfig.categories as any)[primaryCat];
    if (!primary) return titlesConfig.aspirant;

    const parts: string[] = [];
    if (epithet) parts.push(epithet);

    if (entries.length > 1) {
        const [secondaryCat, secondaryScore] = entries[1];
        if (secondaryCat !== primaryCat && secondaryScore / primaryScore >= titlesConfig.secondaryThreshold) {
            const secondary = (titlesConfig.categories as any)[secondaryCat];
            if (secondary?.adjectives?.length) {
                parts.push(pickFrom(secondary.adjectives, `${seed}|adj|${secondaryCat}`));
            }
        }
    }

    if (primary.nouns?.length) {
        parts.push(pickFrom(primary.nouns, `${seed}|noun|${primaryCat}`));
    }
    return parts.join(' ');
}
