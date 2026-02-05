/**
 * LocalStorage cache utilities for Construct metadata
 * Caches permanent/static data to avoid redundant blockchain fetches
 */

import { ConstructMeta, DefeatedStatus, TokenMeta } from './types';

const CACHE_PREFIX = 'signarank';

const CacheKeys = {
    tokenMeta: (tokenId: string) => `${CACHE_PREFIX}:token:${tokenId}`,
    constructMeta: (contractId: string) => `${CACHE_PREFIX}:construct:${contractId}:meta`,
    defeatedStatus: (contractId: string) => `${CACHE_PREFIX}:construct:${contractId}:defeated`,
};

function getItem<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    } catch {
        return null;
    }
}

function setItem<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn('Failed to cache item:', key, e);
    }
}

function removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem(key);
    } catch {
        // ignore
    }
}

export const ConstructCache = {
    // Token metadata (permanent - token metadata doesn't change)
    getTokenMeta(tokenId: string): TokenMeta | null {
        return getItem<TokenMeta>(CacheKeys.tokenMeta(tokenId));
    },

    setTokenMeta(tokenId: string, meta: TokenMeta): void {
        setItem(CacheKeys.tokenMeta(tokenId), meta);
    },

    // Construct metadata (permanent - static contract data)
    getConstructMeta(contractId: string): ConstructMeta | null {
        return getItem<ConstructMeta>(CacheKeys.constructMeta(contractId));
    },

    setConstructMeta(contractId: string, meta: ConstructMeta): void {
        setItem(CacheKeys.constructMeta(contractId), meta);
    },

    // Defeated status (permanent - final state is immutable)
    getDefeatedStatus(contractId: string): DefeatedStatus | null {
        return getItem<DefeatedStatus>(CacheKeys.defeatedStatus(contractId));
    },

    setDefeatedStatus(contractId: string, status: DefeatedStatus): void {
        setItem(CacheKeys.defeatedStatus(contractId), status);
    },

    // Clear all construct-related cache (for debugging/reset)
    clearAll(): void {
        if (typeof window === 'undefined') return;
        const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
        keys.forEach(k => removeItem(k));
    },
};
