import React, { useEffect, useRef, useState } from 'react';

interface VoicePlayButtonProps {
    src: string;
    label?: string;
    volume?: number;
}

/**
 * Click-to-play narration button. Never autoplays — the audio only starts on an
 * explicit user click (and is a deliberate action, so it ignores the ambient
 * master mute). Loads on demand via preload="none".
 */
export const VoicePlayButton: React.FC<VoicePlayButtonProps> = ({ src, label = 'Listen', volume = 1 }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.volume = volume;
        const onPlay = () => setPlaying(true);
        const onStop = () => setPlaying(false);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onStop);
        audio.addEventListener('ended', onStop);
        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onStop);
            audio.removeEventListener('ended', onStop);
        };
    }, [volume]);

    const toggle = () => {
        const audio = audioRef.current;
        if (!audio) return;
        if (playing) {
            audio.pause();
            audio.currentTime = 0;
        } else {
            audio.play().catch(() => {});
        }
    };

    if (!src) return null;

    return (
        <>
            <audio ref={audioRef} src={src} preload="none" />
            <button
                onClick={toggle}
                aria-label={playing ? 'Stop narration' : 'Play narration'}
                className="inline-flex items-center gap-2 py-2 px-5 rounded-sm text-[0.7rem] font-semibold uppercase tracking-[0.15em] transition-all duration-200 hover:brightness-110 active:scale-95"
                style={{
                    fontFamily: "'Cinzel', serif",
                    background: 'rgba(6,4,10,0.75)',
                    border: '1px solid rgba(197,164,78,0.6)',
                    color: 'var(--gold)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(8px)',
                }}
            >
                {playing ? (
                    // stop / pause icon
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <rect x="6" y="5" width="4" height="14" rx="1" />
                        <rect x="14" y="5" width="4" height="14" rx="1" />
                    </svg>
                ) : (
                    // play icon
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <polygon points="6 4 20 12 6 20 6 4" />
                    </svg>
                )}
                <span>{playing ? 'Stop' : label}</span>
            </button>
        </>
    );
};

export default VoicePlayButton;
