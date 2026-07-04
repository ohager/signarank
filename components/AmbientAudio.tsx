import React, { useEffect, useRef } from 'react';
import { useSoundMuted } from '@hooks/useSoundMuted';

interface AmbientAudioProps {
    src: string;
    volume?: number;
}

/**
 * Loops a season's ambient track site-wide. Defaults to on, but browsers block
 * autoplay until the user interacts — so playback also retries on the first
 * gesture. The toggle is a master mute for ALL sounds (ambient, SFX, voice),
 * backed by the shared useSoundMuted store.
 */
export const AmbientAudio: React.FC<AmbientAudioProps> = ({ src, volume = 0.35 }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [muted, setMuted] = useSoundMuted();

    // Drive playback from the muted state
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.volume = volume;

        if (muted) {
            audio.pause();
            return;
        }

        const tryPlay = () => audio.play().catch(() => {});
        tryPlay();

        // If autoplay was blocked, start on the first user gesture anywhere
        const onGesture = () => {
            window.removeEventListener('pointerdown', onGesture);
            window.removeEventListener('keydown', onGesture);
            window.removeEventListener('touchstart', onGesture);
            tryPlay();
        };
        window.addEventListener('pointerdown', onGesture);
        window.addEventListener('keydown', onGesture);
        window.addEventListener('touchstart', onGesture);

        return () => {
            window.removeEventListener('pointerdown', onGesture);
            window.removeEventListener('keydown', onGesture);
            window.removeEventListener('touchstart', onGesture);
        };
    }, [muted, volume, src]);

    const toggle = () => setMuted(!muted);

    if (!src) return null;

    return (
        <>
            <audio ref={audioRef} src={src} loop preload="auto" />
            <button
                onClick={toggle}
                aria-label={muted ? 'Unmute sound' : 'Mute sound'}
                title={muted ? 'Unmute sound' : 'Mute sound'}
                className="fixed bottom-4 right-4 z-50 w-9 h-9 flex items-center justify-center rounded-full backdrop-blur-md transition-all duration-200 hover:brightness-125"
                style={{
                    background: 'rgba(8,6,12,0.55)',
                    border: '1px solid rgba(197,164,78,0.3)',
                    color: 'var(--gold)',
                }}
            >
                {muted ? (
                    // muted speaker
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <line x1="23" y1="9" x2="17" y2="15" />
                        <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                ) : (
                    // speaker with waves
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    </svg>
                )}
            </button>
        </>
    );
};

export default AmbientAudio;
