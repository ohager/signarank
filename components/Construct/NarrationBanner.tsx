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
