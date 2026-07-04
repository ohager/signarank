import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'signarank_sound_muted';
const EVENT = 'signarank-sound-muted-change';

// Global "mute all sounds" flag, shared across ambient, SFX and voice.
// Backed by localStorage and broadcast via a custom event so every audio
// source reacts to the same master switch.

export function isSoundMuted(): boolean {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

export function setSoundMuted(muted: boolean): void {
    try {
        localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
        // ignore persistence failure
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT, { detail: muted }));
    }
}

export function useSoundMuted(): [boolean, (muted: boolean) => void] {
    const [muted, setMutedState] = useState(false);

    useEffect(() => {
        setMutedState(isSoundMuted());
        const handler = () => setMutedState(isSoundMuted());
        window.addEventListener(EVENT, handler);
        window.addEventListener('storage', handler); // sync across tabs
        return () => {
            window.removeEventListener(EVENT, handler);
            window.removeEventListener('storage', handler);
        };
    }, []);

    const set = useCallback((m: boolean) => setSoundMuted(m), []);
    return [muted, set];
}
