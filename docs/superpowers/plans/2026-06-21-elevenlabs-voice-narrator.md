# ElevenLabs Voice Narrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-play a voiced, echo-enhanced narration after each successful construct attack, with a typing animation that covers ElevenLabs generation latency.

**Architecture:** After a successful attack, `AttackForm` fetches the narration text from the existing `pick` endpoint, then immediately fires a new `speak` endpoint that proxies ElevenLabs TTS. The text starts typing character-by-character right away; the audio — decoded and routed through a Web Audio API echo chain — begins playing ~500ms later, mid-sentence. All audio failures are silently swallowed.

**Tech Stack:** Next.js Pages Router API routes, ElevenLabs REST API (`/v1/text-to-speech/{voiceId}`), Web Audio API, Vitest + @testing-library/react

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `pages/api/narrations/speak.ts` | Server-side ElevenLabs TTS proxy |
| Create | `hooks/useTypingEffect.ts` | Interval-based character-reveal hook |
| Create | `hooks/__tests__/useTypingEffect.test.tsx` | Hook unit tests |
| Create | `pages/api/narrations/__tests__/speak.test.ts` | API route unit tests |
| Modify | `components/Construct/NarrationBanner.tsx` | Add typing animation + Web Audio echo |
| Modify | `components/Construct/AttackForm.tsx` | Add audioUrl state + speak fetch + cleanup |

---

## Task 1: `speak.ts` API Route

**Files:**
- Create: `pages/api/narrations/speak.ts`
- Create: `pages/api/narrations/__tests__/speak.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `pages/api/narrations/__tests__/speak.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- pages/api/narrations/__tests__/speak.test.ts
```

Expected: FAIL — `../speak` module not found.

- [ ] **Step 3: Implement `speak.ts`**

Create `pages/api/narrations/speak.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).end();
    }

    const apiKey = process.env.NEXT_SERVER_ELEVENLABS_API_KEY;
    const voiceId = process.env.NEXT_SERVER_ELEVENLABS_VOICE_ID;
    const modelId = process.env.NEXT_SERVER_ELEVENLABS_MODEL_ID ?? 'eleven_turbo_v2_5';

    if (!apiKey || !voiceId) {
        return res.status(204).end();
    }

    const { text } = req.body ?? {};
    if (typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'text is required' });
    }

    try {
        const upstream = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text,
                    model_id: modelId,
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 },
                }),
            }
        );

        if (!upstream.ok) {
            return res.status(204).end();
        }

        const audioBuffer = await upstream.arrayBuffer();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).end(Buffer.from(audioBuffer));
    } catch {
        return res.status(204).end();
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- pages/api/narrations/__tests__/speak.test.ts
```

Expected: PASS — 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add pages/api/narrations/speak.ts pages/api/narrations/__tests__/speak.test.ts
git commit -m "feat: add ElevenLabs TTS proxy endpoint"
```

---

## Task 2: `useTypingEffect` Hook

**Files:**
- Create: `hooks/useTypingEffect.ts`
- Create: `hooks/__tests__/useTypingEffect.test.tsx`

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D @testing-library/react happy-dom
```

Expected: packages added to `devDependencies` in `package.json`.

- [ ] **Step 2: Write the failing tests**

Create `hooks/__tests__/useTypingEffect.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingEffect } from '../useTypingEffect';

describe('useTypingEffect', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns empty string initially', () => {
        const { result } = renderHook(() => useTypingEffect('hello'));
        expect(result.current).toBe('');
    });

    it('returns empty string when text is null', () => {
        const { result } = renderHook(() => useTypingEffect(null));
        expect(result.current).toBe('');
    });

    it('reveals one character per interval tick', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTypingEffect('hi', 30));

        act(() => { vi.advanceTimersByTime(30); });
        expect(result.current).toBe('h');

        act(() => { vi.advanceTimersByTime(30); });
        expect(result.current).toBe('hi');
    });

    it('stops at the full text length', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTypingEffect('ab', 30));

        act(() => { vi.advanceTimersByTime(9999); });
        expect(result.current).toBe('ab');
    });

    it('resets to empty when text changes', () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(
            ({ text }: { text: string }) => useTypingEffect(text, 30),
            { initialProps: { text: 'abc' } }
        );

        act(() => { vi.advanceTimersByTime(60); });
        expect(result.current).toBe('ab');

        rerender({ text: 'xyz' });
        expect(result.current).toBe('');
    });

    it('clears the interval on unmount', () => {
        vi.useFakeTimers();
        const clearSpy = vi.spyOn(globalThis, 'clearInterval');
        const { unmount } = renderHook(() => useTypingEffect('hello', 30));
        unmount();
        expect(clearSpy).toHaveBeenCalled();
    });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- hooks/__tests__/useTypingEffect.test.tsx
```

Expected: FAIL — `../useTypingEffect` module not found.

- [ ] **Step 4: Implement `useTypingEffect`**

Create `hooks/useTypingEffect.ts`:

```ts
import { useState, useEffect } from 'react';

export function useTypingEffect(text: string | null, charInterval = 30): string {
    const [displayed, setDisplayed] = useState('');

    useEffect(() => {
        if (!text) {
            setDisplayed('');
            return;
        }
        setDisplayed('');
        let index = 0;
        const id = setInterval(() => {
            index += 1;
            setDisplayed(text.slice(0, index));
            if (index >= text.length) clearInterval(id);
        }, charInterval);
        return () => clearInterval(id);
    }, [text, charInterval]);

    return displayed;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- hooks/__tests__/useTypingEffect.test.tsx
```

Expected: PASS — 6 tests passing.

- [ ] **Step 6: Commit**

```bash
git add hooks/useTypingEffect.ts hooks/__tests__/useTypingEffect.test.tsx package.json package-lock.json
git commit -m "feat: add useTypingEffect hook for character-reveal animation"
```

---

## Task 3: Update `NarrationBanner`

**Files:**
- Modify: `components/Construct/NarrationBanner.tsx`

- [ ] **Step 1: Replace `NarrationBanner` with the updated version**

Replace the full contents of `components/Construct/NarrationBanner.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { useTypingEffect } from '@hooks/useTypingEffect';

interface NarrationBannerProps {
    text: string | null;
    loading: boolean;
    audioUrl: string | null;
}

export const NarrationBanner: React.FC<NarrationBannerProps> = ({ text, loading, audioUrl }) => {
    const displayedText = useTypingEffect(text);
    const isTyping = !!text && displayedText.length < text.length;
    const audioCtxRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        if (!audioUrl) return;

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        fetch(audioUrl)
            .then(r => r.arrayBuffer())
            .then(buf => ctx.decodeAudioData(buf))
            .then(decoded => {
                const src = ctx.createBufferSource();
                src.buffer = decoded;

                // Dry path (direct signal)
                const dry = ctx.createGain();
                dry.gain.value = 1.0;
                src.connect(dry);
                dry.connect(ctx.destination);

                // Echo path: delay → feedback loop → wet mix
                const delay = ctx.createDelay(1.0);
                delay.delayTime.value = 0.3;
                const feedback = ctx.createGain();
                feedback.gain.value = 0.4;
                const wet = ctx.createGain();
                wet.gain.value = 0.6;

                src.connect(delay);
                delay.connect(feedback);
                feedback.connect(delay);
                feedback.connect(wet);
                wet.connect(ctx.destination);

                src.start();
            })
            .catch(() => {
                // audio is non-critical
            });

        return () => {
            ctx.close().catch(() => {});
        };
    }, [audioUrl]);

    if (!loading && !text) return null;

    return (
        <div
            className="mb-4 py-4 px-5 rounded-sm"
            style={{
                background: 'rgba(197, 164, 78, 0.06)',
                borderLeft: '3px solid var(--gold-bright)',
                animation: text ? 'fadeIn 0.4s ease-out' : undefined,
            }}
        >
            {loading && !text ? (
                <div className="flex flex-col gap-2">
                    <div
                        className="h-4 rounded-sm"
                        style={{
                            background: 'linear-gradient(90deg, rgba(197,164,78,0.05) 25%, rgba(197,164,78,0.12) 50%, rgba(197,164,78,0.05) 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                            width: '100%',
                        }}
                    />
                    <div
                        className="h-4 rounded-sm"
                        style={{
                            background: 'linear-gradient(90deg, rgba(197,164,78,0.05) 25%, rgba(197,164,78,0.12) 50%, rgba(197,164,78,0.05) 75%)',
                            backgroundSize: '200% 100%',
                            animation: 'shimmer 1.5s infinite',
                            width: '70%',
                        }}
                    />
                </div>
            ) : (
                <p
                    className="text-[1.1rem] text-[var(--text-dim)] font-bold m-0 leading-[1.7] max-md:text-[1rem]"
                    style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontStyle: 'italic',
                    }}
                >
                    {displayedText}
                    {isTyping && (
                        <span
                            className="inline-block animate-pulse ml-0.5 opacity-60"
                            style={{ fontStyle: 'normal' }}
                        >
                            |
                        </span>
                    )}
                </p>
            )}
        </div>
    );
};
```

- [ ] **Step 2: Run the full test suite to check for regressions**

```bash
npm test
```

Expected: all previously passing tests still pass.

- [ ] **Step 3: Commit**

```bash
git add components/Construct/NarrationBanner.tsx
git commit -m "feat: add typing animation and Web Audio echo to NarrationBanner"
```

---

## Task 4: Update `AttackForm`

**Files:**
- Modify: `components/Construct/AttackForm.tsx`

- [ ] **Step 1: Add `audioUrl` state (line ~32, after `narrationLoading` state)**

In `components/Construct/AttackForm.tsx`, add after:
```tsx
const [narrationLoading, setNarrationLoading] = useState(false);
```
Add:
```tsx
const [audioUrl, setAudioUrl] = useState<string | null>(null);
```

- [ ] **Step 2: Add the `fetchAudio` helper (after `fetchNarration`, around line ~142)**

Add this function after the `fetchNarration` function:

```tsx
const fetchAudio = async (text: string) => {
    try {
        const res = await fetch('/api/narrations/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });
        if (res.ok) {
            const blob = await res.blob();
            setAudioUrl(URL.createObjectURL(blob));
        }
    } catch {
        // audio is non-critical
    }
};
```

- [ ] **Step 3: Fire `fetchAudio` after narration text is set**

In `fetchNarration`, replace:
```tsx
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            const body = await res.json();
            setNarration(body.text);
        }
```
With:
```tsx
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            const body = await res.json();
            setNarration(body.text);
            fetchAudio(body.text);
        }
```

- [ ] **Step 4: Clean up blob URL and audio state on reset**

In the success view, replace:
```tsx
        const handleAttackAgain = () => {
            setNarration(null);
            reset();
        };
```
With:
```tsx
        const handleAttackAgain = () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
            setNarration(null);
            reset();
        };
```

- [ ] **Step 5: Pass `audioUrl` to `NarrationBanner`**

Replace:
```tsx
<NarrationBanner text={narration} loading={narrationLoading} />
```
With:
```tsx
<NarrationBanner text={narration} loading={narrationLoading} audioUrl={audioUrl} />
```

- [ ] **Step 6: Run the full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/Construct/AttackForm.tsx
git commit -m "feat: integrate voice narration into attack flow"
```

---

## Task 5: Add env vars to `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document the new env vars**

In `.env.example`, add after the `NEXT_SERVER_NFT_SERVICE_API_KEY` block:

```bash
# ElevenLabs Voice Narration
# Server-side only — never expose to client
# Voice must be pre-created in ElevenLabs dashboard
NEXT_SERVER_ELEVENLABS_API_KEY=
NEXT_SERVER_ELEVENLABS_VOICE_ID=
# Model ID — see https://elevenlabs.io/docs/speech-synthesis/models
# Recommended: eleven_turbo_v2_5 (fast) or eleven_multilingual_v2 (quality)
NEXT_SERVER_ELEVENLABS_MODEL_ID=eleven_turbo_v2_5
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: document ElevenLabs env vars in .env.example"
```
