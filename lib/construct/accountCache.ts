import {type Account, Ledger} from '@signumjs/core';

const TTL_MS = 120_000;

interface CacheEntry {
    account: Account;
    expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function resolveAccount(ledger: Ledger, accountId: string): Promise<Account|null> {
    const cached = cache.get(accountId);
    if (cached && cached.expiresAt > Date.now()) return cached.account;

    try {
        const account = await ledger.account.getAccount({accountId});
        cache.set(accountId, { account, expiresAt: Date.now() + TTL_MS });
        return account;
    } catch {
        return null;
    }
}
