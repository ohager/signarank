import { AttackNarration } from '@prisma/client';

export function pickNarration(
    candidates: AttackNarration[],
    desiredTags: string[]
): AttackNarration | null {
    if (candidates.length === 0) return null;

    const desiredSet = new Set(desiredTags);

    let bestScore = -1;
    let bestCandidates: AttackNarration[] = [];

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
