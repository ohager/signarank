import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../speak';

vi.mock('@lib/narration/repository', () => ({
    findNarrations: vi.fn(),
}));
vi.mock('@lib/narration/pickNarration', () => ({
    pickNarration: vi.fn(),
}));

import { findNarrations } from '@lib/narration/repository';
import { pickNarration } from '@lib/narration/pickNarration';

const VALID_QUERY = {
    seasonName: 'frostfest',
    constructName: 'CT000001',
    locale: 'en',
    tags: 'solid_hit,fresh',
};

function makeReq(overrides: object = {}): any {
    return { method: 'GET', query: { ...VALID_QUERY }, headers: {}, ...overrides };
}

function makeRes(): any {
    let statusCode = 200;
    const res = {
        get statusCode() { return statusCode; },
        status: vi.fn().mockImplementation((code: number) => { statusCode = code; return res; }),
        json: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        setHeader: vi.fn(),
        write: vi.fn(),
    };
    return res;
}

describe('GET /api/narrations/speak', () => {
    beforeEach(() => {
        delete process.env.NEXT_SERVER_ELEVENLABS_API_KEY;
        delete process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID;
        delete process.env.NEXT_PUBLIC_NARRATION_API_KEY;
        vi.mocked(findNarrations).mockResolvedValue([]);
        vi.mocked(pickNarration).mockReturnValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 401 when narration key is set and header is missing', async () => {
        process.env.NEXT_PUBLIC_NARRATION_API_KEY = 'secret';
        const res = makeRes();
        await handler(makeReq(), res);
        expect(res.statusCode).toBe(401);
    });

    it('returns 401 when narration key is set and header is wrong', async () => {
        process.env.NEXT_PUBLIC_NARRATION_API_KEY = 'secret';
        const res = makeRes();
        await handler(makeReq({ headers: { 'x-api-key': 'wrong' } }), res);
        expect(res.statusCode).toBe(401);
    });

    it('allows request when narration key matches', async () => {
        process.env.NEXT_PUBLIC_NARRATION_API_KEY = 'secret';
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID = 'test-voice';
        const res = makeRes();
        await handler(makeReq({ headers: { 'x-api-key': 'secret' } }), res);
        expect(res.statusCode).not.toBe(401);
    });

    it('skips key check when NEXT_PUBLIC_NARRATION_API_KEY is not set', async () => {
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID = 'test-voice';
        const res = makeRes();
        await handler(makeReq(), res);
        expect(res.statusCode).not.toBe(401);
    });

    it('returns 405 for non-GET requests', async () => {
        const res = makeRes();
        await handler(makeReq({ method: 'POST' }), res);
        expect(res.statusCode).toBe(405);
    });

    it('returns 204 when NEXT_SERVER_ELEVENLABS_API_KEY is missing', async () => {
        const res = makeRes();
        await handler(makeReq(), res);
        expect(res.statusCode).toBe(204);
    });

    it('returns 204 when NEXT_SERVER_ELEVENLABS_VOICE_ID is missing', async () => {
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        const res = makeRes();
        await handler(makeReq(), res);
        expect(res.statusCode).toBe(204);
    });

    it('returns 400 when seasonName is missing', async () => {
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID = 'test-voice';
        const res = makeRes();
        await handler(makeReq({ query: { ...VALID_QUERY, seasonName: undefined } }), res);
        expect(res.statusCode).toBe(400);
    });

    it('returns 204 when no narration is found in DB', async () => {
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID = 'test-voice';
        vi.mocked(pickNarration).mockReturnValue(null);
        const res = makeRes();
        await handler(makeReq(), res);
        expect(res.statusCode).toBe(204);
    });

    it('returns 204 when ElevenLabs returns a non-ok response', async () => {
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID = 'test-voice';
        vi.mocked(pickNarration).mockReturnValue({ id: 1, text: 'The construct trembles.', tags: [] });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
        const res = makeRes();
        await handler(makeReq(), res);
        expect(res.statusCode).toBe(204);
    });

    it('returns audio/mpeg and never calls ElevenLabs with arbitrary text', async () => {
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID = 'test-voice';
        const narrationText = 'The construct trembles beneath your strike.';
        vi.mocked(pickNarration).mockReturnValue({ id: 1, text: narrationText, tags: [] });
        const fakeAudio = new Uint8Array([1, 2, 3]).buffer;
        const mockFetch = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(fakeAudio) });
        vi.stubGlobal('fetch', mockFetch);
        const res = makeRes();
        await handler(makeReq(), res);
        // ElevenLabs is called with the DB text, not any client-supplied text
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.text).toBe(narrationText);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
        expect(res.end).toHaveBeenCalledWith(Buffer.from(fakeAudio));
    });
});
