import React from 'react';

interface NarrationBannerProps {
    text: string | null;
    loading: boolean;
}

export const NarrationBanner: React.FC<NarrationBannerProps> = ({ text, loading }) => {
    if (!loading && !text) return null;

    return (
        <div
            className="mb-4 py-3 px-4 rounded-sm"
            style={{
                background: 'rgba(197, 164, 78, 0.06)',
                borderLeft: '2px solid var(--ember)',
                animation: text ? 'fadeIn 0.4s ease-out' : undefined,
            }}
        >
            {loading && !text ? (
                <div
                    className="h-4 rounded-sm"
                    style={{
                        background: 'linear-gradient(90deg, rgba(197,164,78,0.05) 25%, rgba(197,164,78,0.12) 50%, rgba(197,164,78,0.05) 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite',
                    }}
                />
            ) : (
                <p
                    className="text-[0.9rem] text-[var(--text-dim)] m-0 leading-relaxed max-md:text-[0.85rem]"
                    style={{
                        fontFamily: "'Cormorant Garamond', serif",
                        fontStyle: 'italic',
                    }}
                >
                    {text}
                </p>
            )}
        </div>
    );
};
