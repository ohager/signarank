// lib/character/creationProgress.test.ts
import { describe, it, expect } from 'vitest';
import { deriveProgressState } from './creationProgress';

describe('deriveProgressState', () => {
    it('is pending when neither transaction has landed in a block', () => {
        expect(deriveProgressState(-1, -1)).toBe('pending');
    });

    it('is deployed once tx1 has landed but tx2 has not', () => {
        expect(deriveProgressState(0, -1)).toBe('deployed');
        expect(deriveProgressState(5, -1)).toBe('deployed');
    });

    it('is funding_settled once tx2 has 0 confirmations', () => {
        expect(deriveProgressState(1, 0)).toBe('funding_settled');
    });

    it('is live once tx2 has 1 or more confirmations', () => {
        expect(deriveProgressState(2, 1)).toBe('live');
        expect(deriveProgressState(10, 5)).toBe('live');
    });
});
