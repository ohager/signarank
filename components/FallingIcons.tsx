import React, {useState, useEffect} from 'react';

interface FallingIconsProps {
    emojis: string[]
}

const FallingIcons = React.memo(({emojis}: FallingIconsProps) => {
    const [snowflakes, setSnowflakes] = useState<Array<{
        left: string; animationDelay: string; animationDuration: string;
        opacity: number; fontSize: string; rotation: string; emoji: string;
    }>>([]);

    useEffect(() => {
        setSnowflakes(
            Array.from({length: 50}, () => ({
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 10}s`,
                animationDuration: `${10 + Math.random() * 20}s`,
                opacity: 0.15 + Math.random() * 0.35,
                fontSize: `${8 + Math.random() * 16}px`,
                rotation: `${Math.random() * 360}deg`,
                emoji: emojis[Math.floor(Math.random() * emojis.length)],
            }))
        );
    }, [emojis]);

    if (snowflakes.length === 0) return null;

    return (
        <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden">
            {snowflakes.map((flake, index) => (
                <div
                    key={index}
                    className="absolute -top-5 text-white select-none animate-[fall_linear_infinite]"
                    style={{
                        left: flake.left,
                        animationDelay: flake.animationDelay,
                        animationDuration: flake.animationDuration,
                        opacity: flake.opacity,
                        fontSize: flake.fontSize,
                        '--rotation': flake.rotation,
                    } as React.CSSProperties}
                >
                    {flake.emoji}
                </div>
            ))}
        </div>
    );
});

FallingIcons.displayName = 'FallingIcons';

export default FallingIcons;
