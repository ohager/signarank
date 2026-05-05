import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Non-browser clients: 10 req / 60s per IP
const BOT_LIMIT = 10;
const BOT_WINDOW_MS = 60_000;

// /api/address/:id: 1 req / 1s per IP for all clients
const ADDRESS_LIMIT = 1;
const ADDRESS_WINDOW_MS = 1_000;

type RateEntry = {count: number; resetAt: number};
const botCounts = new Map<string, RateEntry>();
const addressCounts = new Map<string, RateEntry>();

function getIp(req: NextRequest): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

function pruneExpired(map: Map<string, RateEntry>, now: number) {
    map.forEach((entry, key) => {
        if (entry.resetAt <= now) map.delete(key);
    });
}

function rateLimit(
    map: Map<string, RateEntry>,
    key: string,
    limit: number,
    windowMs: number,
    now: number,
): {allowed: boolean; resetAt: number} {
    if (map.size > 10_000) pruneExpired(map, now);
    const entry = map.get(key);
    if (!entry || entry.resetAt <= now) {
        map.set(key, {count: 1, resetAt: now + windowMs});
        return {allowed: true, resetAt: now + windowMs};
    }
    if (entry.count >= limit) {
        return {allowed: false, resetAt: entry.resetAt};
    }
    entry.count++;
    return {allowed: true, resetAt: entry.resetAt};
}

// Sec-Fetch-Site is injected by browsers per the Fetch Metadata spec; bots omit it.
function isBrowser(req: NextRequest): boolean {
    return req.headers.has('sec-fetch-site');
}

function tooMany(resetAt: number, now: number): NextResponse {
    return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {'Retry-After': String(Math.ceil((resetAt - now) / 1000))},
    });
}

export function proxy(req: NextRequest) {
    const ip = getIp(req);
    const now = Date.now();

    // /address/:id page — 1 req/s hard limit for everyone
    if (req.nextUrl.pathname.startsWith('/address/')) {
        const {allowed, resetAt} = rateLimit(addressCounts, ip, ADDRESS_LIMIT, ADDRESS_WINDOW_MS, now);
        if (!allowed) return tooMany(resetAt, now);
        return NextResponse.next();
    }

    // All other API routes — browsers pass through, non-browsers are rate limited
    if (!isBrowser(req)) {
        const {allowed, resetAt} = rateLimit(botCounts, ip, BOT_LIMIT, BOT_WINDOW_MS, now);
        if (!allowed) return tooMany(resetAt, now);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/api/:path*', '/address/:path*'],
};
