import { describe, it, expect, beforeEach } from 'vitest';
import {
    getPendingCharacters,
    upsertPendingCharacter,
    updatePendingCharacter,
    removePendingCharacter,
    saveDraft,
    loadDraft,
    clearDraft,
    type PendingCharacter,
} from './pendingCharacters';

class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length() { return this.store.size; }
    clear() { this.store.clear(); }
    getItem(key: string) { return this.store.has(key) ? this.store.get(key)! : null; }
    key(index: number) { return Array.from(this.store.keys())[index] ?? null; }
    removeItem(key: string) { this.store.delete(key); }
    setItem(key: string, value: string) { this.store.set(key, value); }
}

const ACCOUNT = '12345678901234567890';

const sample = (contractId: string): PendingCharacter => ({
    contractId,
    tx1Id: `${contractId}-tx1`,
    name: 'Test Hero',
    description: 'A test character',
    avatarCid: 'bafy123',
    avatarMime: 'image/png',
    avatarUrl: 'https://r2.signarank.club/bafy123',
    submittedAt: Date.now(),
    state: 'pending',
});

describe('pendingCharacters', () => {
    let storage: Storage;

    beforeEach(() => {
        storage = new MemoryStorage();
    });

    it('returns an empty array when nothing is stored', () => {
        expect(getPendingCharacters(ACCOUNT, storage)).toEqual([]);
    });

    it('upserts a new entry', () => {
        const entry = sample('111');
        upsertPendingCharacter(ACCOUNT, entry, storage);
        expect(getPendingCharacters(ACCOUNT, storage)).toEqual([entry]);
    });

    it('upserting an existing contractId replaces it rather than duplicating', () => {
        const entry = sample('111');
        upsertPendingCharacter(ACCOUNT, entry, storage);
        upsertPendingCharacter(ACCOUNT, { ...entry, state: 'deployed' }, storage);
        const all = getPendingCharacters(ACCOUNT, storage);
        expect(all).toHaveLength(1);
        expect(all[0]!.state).toBe('deployed');
    });

    it('scopes entries by accountId', () => {
        upsertPendingCharacter(ACCOUNT, sample('111'), storage);
        upsertPendingCharacter('other-account', sample('222'), storage);
        expect(getPendingCharacters(ACCOUNT, storage)).toHaveLength(1);
        expect(getPendingCharacters('other-account', storage)).toHaveLength(1);
    });

    it('patches an existing entry by contractId', () => {
        upsertPendingCharacter(ACCOUNT, sample('111'), storage);
        updatePendingCharacter(ACCOUNT, '111', { state: 'funding_settled', tx2Id: 'tx2-abc' }, storage);
        const [updated] = getPendingCharacters(ACCOUNT, storage);
        expect(updated!.state).toBe('funding_settled');
        expect(updated!.tx2Id).toBe('tx2-abc');
    });

    it('patching a missing contractId is a no-op', () => {
        updatePendingCharacter(ACCOUNT, 'does-not-exist', { state: 'live' }, storage);
        expect(getPendingCharacters(ACCOUNT, storage)).toEqual([]);
    });

    it('removes an entry by contractId', () => {
        upsertPendingCharacter(ACCOUNT, sample('111'), storage);
        upsertPendingCharacter(ACCOUNT, sample('222'), storage);
        removePendingCharacter(ACCOUNT, '111', storage);
        const remaining = getPendingCharacters(ACCOUNT, storage);
        expect(remaining).toHaveLength(1);
        expect(remaining[0]!.contractId).toBe('222');
    });

    it('ignores malformed stored JSON rather than throwing', () => {
        storage.setItem(`signarank:pendingCharacters:${ACCOUNT}`, '{not valid json');
        expect(getPendingCharacters(ACCOUNT, storage)).toEqual([]);
    });

    it('round-trips a creation draft (pre-contractId mobile staging)', () => {
        const draft = {
            name: 'Draft Hero',
            description: 'still deploying',
            avatarCid: 'bafy999',
            avatarMime: 'image/jpeg',
            avatarUrl: 'https://r2.signarank.club/bafy999',
        };
        expect(loadDraft(ACCOUNT, storage)).toBeNull();
        saveDraft(ACCOUNT, draft, storage);
        expect(loadDraft(ACCOUNT, storage)).toEqual(draft);
        clearDraft(ACCOUNT, storage);
        expect(loadDraft(ACCOUNT, storage)).toBeNull();
    });
});
