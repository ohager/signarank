export type PendingCharacterState =
    | 'pending'
    | 'deployed'
    | 'funding_settled'
    | 'live'
    | 'needs_funding'
    | 'failed';

export interface PendingCharacter {
    contractId: string;
    tx1Id: string;
    /** Only available on desktop/extension (chained) creations — mobile's
     * MobileWallet.parseSignCallback() doesn't return a fullHash. */
    tx1FullHash?: string;
    tx2Id?: string;
    name: string;
    description: string;
    avatarCid: string;
    avatarMime: string;
    avatarUrl: string;
    submittedAt: number;
    state: PendingCharacterState;
    error?: string;
}

export interface CreationDraft {
    name: string;
    description: string;
    avatarCid: string;
    avatarMime: string;
    avatarUrl: string;
}

const storageKey = (accountId: string) => `signarank:pendingCharacters:${accountId}`;
const draftKey = (accountId: string) => `signarank:pendingCharacterDraft:${accountId}`;

const resolveStorage = (storage?: Storage): Storage | null => {
    if (storage) return storage;
    if (typeof window === 'undefined') return null;
    return window.localStorage;
};

export function getPendingCharacters(accountId: string, storage?: Storage): PendingCharacter[] {
    const s = resolveStorage(storage);
    if (!s) return [];
    const raw = s.getItem(storageKey(accountId));
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as PendingCharacter[]) : [];
    } catch {
        return [];
    }
}

function writePendingCharacters(accountId: string, characters: PendingCharacter[], storage?: Storage): void {
    const s = resolveStorage(storage);
    if (!s) return;
    s.setItem(storageKey(accountId), JSON.stringify(characters));
}

export function upsertPendingCharacter(accountId: string, character: PendingCharacter, storage?: Storage): void {
    const existing = getPendingCharacters(accountId, storage);
    const next = existing.filter(c => c.contractId !== character.contractId);
    next.push(character);
    writePendingCharacters(accountId, next, storage);
}

export function updatePendingCharacter(
    accountId: string,
    contractId: string,
    patch: Partial<PendingCharacter>,
    storage?: Storage,
): void {
    const existing = getPendingCharacters(accountId, storage);
    const next = existing.map(c => (c.contractId === contractId ? { ...c, ...patch } : c));
    writePendingCharacters(accountId, next, storage);
}

export function removePendingCharacter(accountId: string, contractId: string, storage?: Storage): void {
    const existing = getPendingCharacters(accountId, storage);
    writePendingCharacters(accountId, existing.filter(c => c.contractId !== contractId), storage);
}

/** Stashes the wizard's composed identity before a mobile deploy-signing
 * redirect, since the page reloads before a contractId (and therefore a
 * PendingCharacter entry) exists yet. */
export function saveDraft(accountId: string, draft: CreationDraft, storage?: Storage): void {
    const s = resolveStorage(storage);
    if (!s) return;
    s.setItem(draftKey(accountId), JSON.stringify(draft));
}

export function loadDraft(accountId: string, storage?: Storage): CreationDraft | null {
    const s = resolveStorage(storage);
    if (!s) return null;
    const raw = s.getItem(draftKey(accountId));
    if (!raw) return null;
    try {
        return JSON.parse(raw) as CreationDraft;
    } catch {
        return null;
    }
}

export function clearDraft(accountId: string, storage?: Storage): void {
    const s = resolveStorage(storage);
    if (!s) return;
    s.removeItem(draftKey(accountId));
}
