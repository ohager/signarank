import { R2_CDN_BASE } from './constants';

type DamageTier = 'dmgl' | 'dmgm' | 'dmgh' | 'dead';

function getDamageTier(isDefeated: boolean, hpPercent: number): DamageTier | null {
    if (isDefeated) return 'dead';
    if (hpPercent <= 0.25) return 'dmgh';
    if (hpPercent <= 0.50) return 'dmgm';
    if (hpPercent <= 0.75) return 'dmgl';
    return null;
}

export function resolveDamageVariantUrl(
    ipfsCid: string | null,
    isDefeated: boolean,
    hp: number,
    maxHp: number,
): string | null {
    if (!ipfsCid || maxHp <= 0) return null;
    const tier = getDamageTier(isDefeated, hp / maxHp);
    if (!tier) return null;
    return `${R2_CDN_BASE}/${ipfsCid}-${tier}`;
}

interface CacheEntry {
    url: string;
    expiresAt: number;
}

const existenceCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60_000;

export async function resolveDisplayUrl(variantUrl: string, fallbackUrl: string): Promise<string> {
    const now = Date.now();
    const cached = existenceCache.get(variantUrl);
    if (cached && now < cached.expiresAt) {
        return cached.url;
    }
    try {
        const checkUrl = `/api/asset/exists?url=${encodeURIComponent(variantUrl)}`;
        const res = await fetch(checkUrl);
        const { exists } = await res.json();
        const url = exists ? variantUrl : fallbackUrl;
        existenceCache.set(variantUrl, { url, expiresAt: now + CACHE_TTL_MS });
        return url;
    } catch {
        return fallbackUrl;
    }
}
