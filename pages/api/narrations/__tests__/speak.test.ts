import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import handler from '../speak';

function makeReq(overrides: object = {}): any {
    return { method: 'POST', body: { text: 'The construct trembles.' }, ...overrides };
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

describe('POST /api/narrations/speak', () => {
    beforeEach(() => {
        delete process.env.NEXT_SERVER_ELEVENLABS_API_KEY;
        delete process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns 405 for non-POST requests', async () => {
        const res = makeRes();
        await handler(makeReq({ method: 'GET' }), res);
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

    it('returns 400 when text is empty', async () => {
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID = 'test-voice';
        const res = makeRes();
        await handler(makeReq({ body: { text: '' } }), res);
        expect(res.statusCode).toBe(400);
    });

    it('returns 400 when text is missing', async () => {
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID = 'test-voice';
        const res = makeRes();
        await handler(makeReq({ body: {} }), res);
        expect(res.statusCode).toBe(400);
    });

    it('returns 204 when ElevenLabs returns a non-ok response', async () => {
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID = 'test-voice';
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
        const res = makeRes();
        await handler(makeReq(), res);
        expect(res.statusCode).toBe(204);
    });

    it('pipes audio/mpeg response when ElevenLabs succeeds', async () => {
        process.env.NEXT_SERVER_ELEVENLABS_API_KEY = 'test-key';
        process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID = 'test-voice';
        const fakeAudio = new Uint8Array([1, 2, 3]).buffer;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            arrayBuffer: vi.fn().mockResolvedValue(fakeAudio),
        }));
        const res = makeRes();
        await handler(makeReq(), res);
        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'audio/mpeg');
        expect(res.end).toHaveBeenCalledWith(Buffer.from(fakeAudio));
    });
});
