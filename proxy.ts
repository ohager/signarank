import {NextRequest, NextResponse} from 'next/server';

const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;

const ipCounts = new Map<string, {count: number; resetAt: number}>();

function getIp(req: NextRequest): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

function pruneExpired(now: number) {
    ipCounts.forEach((entry, key) => {
        if (entry.resetAt <= now) ipCounts.delete(key);
    });
}

export function proxy(req: NextRequest) {
    const ip = getIp(req);
    const now = Date.now();

    if (ipCounts.size > 10_000) pruneExpired(now);

    const entry = ipCounts.get(ip);
    if (!entry || entry.resetAt <= now) {
        ipCounts.set(ip, {count: 1, resetAt: now + WINDOW_MS});
        return NextResponse.next();
    }

    if (entry.count >= RATE_LIMIT) {
        return new NextResponse('Too Many Requests', {
            status: 429,
            headers: {'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000))},
        });
    }

    entry.count++;
    return NextResponse.next();
}

export const config = {
    matcher: '/api/score/:path*',
};
