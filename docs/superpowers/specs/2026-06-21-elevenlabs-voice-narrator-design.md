# ElevenLabs Voice Narrator — Design Spec

**Date:** 2026-06-21  
**Branch:** feat/attack-narrator  
**Status:** Approved

---

## Overview

After a successful attack on a construct, the existing narration system fetches a contextual story text and displays it in `NarrationBanner`. This feature adds voice storytelling using ElevenLabs TTS, with a typing animation that covers the generation latency, and a Web Audio API echo effect for dramatic atmosphere.

---

## Goals

- Auto-play voice narration immediately after a successful attack
- Typing animation masks ElevenLabs generation latency (~500ms)
- Echo effect via Web Audio API adds immersive depth
- Fully graceful degradation — audio failure never breaks the UI

---

## Out of Scope

- Audio caching (volume is low: ≤50 attacks per construct, texts are short)
- Pre-generated attack sound FX (deferred — good idea, separate feature)
- ElevenLabs sound generation API (too slow for real-time FX, ~3-6s)

---

## Environment Variables

Server-side only (never `NEXT_PUBLIC_`):

| Variable | Purpose |
|---|---|
| `NEXT_SERVER_ELEVENLABS_API_KEY` | ElevenLabs API authentication |
| `NEXT_SERVER_ELEVENLABS_VOICE_ID` | Pre-created narrator voice ID |
| `NEXT_SERVER_ELEVENLABS_MODEL_ID` | TTS model (e.g. `eleven_multilingual_v2`, `eleven_turbo_v2_5`) |

---

## Data Flow

```
Attack button clicked
  └─ handleAttack() → blockchain TX signed & broadcast

TX confirmed (lastResult.success)
  └─ fetchNarration()
       ├─ GET /api/narrations/pick?{seasonName,constructName,locale,tags}
       │    └─ returns { text }
       │         ├─ setNarration(text)        → NarrationBanner typing animation starts
       │         └─ POST /api/narrations/speak  { text }
       │              └─ server calls ElevenLabs /v1/text-to-speech/{voiceId}/stream
       │                   └─ returns audio/mpeg stream
       │                        └─ client creates Blob URL
       │                             └─ setAudioUrl(url)
       │                                  └─ Web Audio API: decode → echo chain → play
       └─ errors in either branch silently swallowed (narration is non-critical)
```

---

## Components

### New: `/pages/api/narrations/speak.ts`

- Method: POST
- Body: `{ text: string }`
- Reads `NEXT_SERVER_ELEVENLABS_API_KEY` and `NEXT_SERVER_ELEVENLABS_VOICE_ID` from env
- Calls ElevenLabs `POST /v1/text-to-speech/{voiceId}/stream`
- Pipes the `audio/mpeg` response stream directly to the client
- Returns `204` (no content, silent) if env vars are missing
- Returns `204` on any ElevenLabs error — never exposes upstream errors to client

### Modified: `AttackForm.tsx`

- Adds `audioUrl: string | null` state
- `fetchNarration` flow:
  1. Fetch `pick` → get text
  2. `setNarration(text)` — typing starts immediately
  3. Fetch `speak({ text })` → get audio blob → `URL.createObjectURL`
  4. `setAudioUrl(url)`
- Passes `audioUrl` to `NarrationBanner`
- `handleAttackAgain`: calls `URL.revokeObjectURL(audioUrl)` before reset to prevent memory leak

### Modified: `NarrationBanner.tsx`

**Typing animation:**
- On `text` prop change, starts an interval (~30ms/char) that reveals characters one by one
- Interval is cleared and restarted cleanly if `text` changes mid-animation
- Interval cleared on unmount

**Web Audio echo playback:**
- When `audioUrl` is set, fetches the blob as `ArrayBuffer`, decodes via `AudioContext.decodeAudioData`
- Builds echo chain:
  ```
  AudioBufferSourceNode
    ├─ DryGainNode (gain: 1.0) ──────────────────→ destination
    └─ DelayNode (delayTime: 0.3s)
         └─ FeedbackGainNode (gain: 0.4)
              ├─ back into DelayNode
              └─ WetGainNode (gain: 0.6) ──────→ destination
  ```
- Starts playback; `AudioContext` created once per component instance
- Falls back silently if `AudioContext` is unavailable (old browsers)

**Props:**
```ts
interface NarrationBannerProps {
  text: string | null;
  loading: boolean;
  audioUrl: string | null;
}
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| ElevenLabs unavailable | `speak` returns 204 → no `audioUrl` set → typing animation plays alone |
| `NEXT_SERVER_ELEVENLABS_*` vars missing | Same as above — silent 204 |
| `pick` fails | Existing behavior: `NarrationBanner` stays hidden |
| Browser autoplay blocked | Not a risk — triggered from Attack button click (counts as user gesture) |
| `AudioContext` unavailable | Silent catch — audio simply doesn't play |
| Blob URL not revoked | `URL.revokeObjectURL` on reset + unmount |

---

## Testing

- Unit test: typing animation interval logic — verify characters reveal at correct cadence, cleans up on unmount
- Manual: verify typing starts before audio, audio plays mid-sentence with audible echo, graceful silence when API key is absent
