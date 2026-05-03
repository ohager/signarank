export interface Narration {
    id: number | string;
    text: string;
    tags: string[];
}

export function pickNarration(
    candidates: Narration[],
    desiredTags: string[]
): Narration | null {
    if (candidates.length === 0) return null;

    const desiredSet = new Set(desiredTags);

    let bestScore = -1;
    let bestCandidates: Narration[] = [];

    for (const candidate of candidates) {
        let score = 0;
        for (const tag of candidate.tags) {
            if (desiredSet.has(tag)) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestCandidates = [candidate];
        } else if (score === bestScore) {
            bestCandidates.push(candidate);
        }
    }

    return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
}
