import React, { useState } from 'react';

interface TrailerButtonProps {
    src: string;
    variant: 'link' | 'pill';
    label?: string;
}

/**
 * Opens the season trailer in a fullscreen lightbox on click. Renders nothing
 * when no trailer source is provided. Mirrors the lightbox styling used for
 * the construct image lightbox in ConstructCard.tsx for visual consistency.
 */
export const TrailerButton: React.FC<TrailerButtonProps> = ({ src, variant, label = 'Watch Trailer' }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!src) return null;

    return (
        <>
            {variant === 'link' ? (
                <button
                    onClick={() => setIsOpen(true)}
                    className="text-[0.75rem] underline underline-offset-4 opacity-80 hover:opacity-100 transition-opacity"
                    style={{ fontFamily: "'Cormorant Garamond', serif", color: 'var(--text)' }}
                >
                    &#9658; {label}
                </button>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
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
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <polygon points="6 4 20 12 6 20 6 4" />
                    </svg>
                    <span>{label}</span>
                </button>
            )}

            {isOpen && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Season trailer"
                    onClick={() => setIsOpen(false)}
                    className="fixed inset-0 z-[1000] flex justify-center items-center p-6 max-md:p-3 bg-black/85 backdrop-blur-md cursor-zoom-out animate-[fadeIn_0.2s_ease-out]"
                    style={{ animation: 'fadeIn 0.2s ease-out' }}
                >
                    <video
                        src={src}
                        autoPlay
                        controls
                        playsInline
                        onClick={(e) => e.stopPropagation()}
                        className="max-w-[min(90vw,900px)] max-h-[90vh] object-contain rounded-sm shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
                    />
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        aria-label="Close"
                        className="fixed top-4 right-4 w-10 h-10 flex justify-center items-center rounded-full bg-black/60 border border-white/20 text-white text-xl hover:bg-black/80 transition-colors"
                    >
                        &times;
                    </button>
                </div>
            )}
        </>
    );
};

export default TrailerButton;
