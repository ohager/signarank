import React from 'react';

interface NarrationBannerProps {
    text: string | null;
    loading: boolean;
}

export const NarrationBanner: React.FC<NarrationBannerProps> = ({ text, loading }) => {
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
                    {text}
                </p>
            )}
        </div>
    );
};
