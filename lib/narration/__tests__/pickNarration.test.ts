import { describe, it, expect } from 'vitest';
import { pickNarration, type Narration } from '../pickNarration';

function makeNarration(id: number, tags: string[]): Narration {
    return { id, text: `Narration ${id}`, tags };
}

describe('pickNarration', () => {
    it('returns null for empty candidates', () => {
        expect(pickNarration([], ['whale', 'fresh'])).toBeNull();
    });

    it('returns the single best match', () => {
        const candidates = [
            makeNarration(1, ['whale', 'fresh', 'full_health']),
            makeNarration(2, ['pocket_change', 'debuffed']),
        ];
        const result = pickNarration(candidates, ['whale', 'fresh']);
        expect(result?.id).toBe(1);
    });

    it('picks from tied candidates', () => {
        const candidates = [
            makeNarration(1, ['whale']),
            makeNarration(2, ['whale']),
        ];
        const result = pickNarration(candidates, ['whale']);
        expect(result).not.toBeNull();
        expect([1, 2]).toContain(result!.id);
    });

    it('returns a candidate even when no tags overlap', () => {
        const candidates = [
            makeNarration(1, ['fresh']),
            makeNarration(2, ['debuffed']),
        ];
        const result = pickNarration(candidates, ['whale']);
        expect(result).not.toBeNull();
    });

    it('scores by intersection size, not candidate tag count', () => {
        const candidates = [
            makeNarration(1, ['whale', 'fresh', 'full_health', 'safe_attack', 'no_token']),
            makeNarration(2, ['whale', 'debuffed']),
        ];
        const result = pickNarration(candidates, ['whale', 'fresh', 'full_health']);
        expect(result?.id).toBe(1);
    });
});
