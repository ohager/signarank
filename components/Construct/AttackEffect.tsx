import React, { useEffect, useState } from 'react';

const SPARK_COUNT = 28;
const COLORS = [
    'var(--ember)',
    '#e85d3a',
    '#f07848',
    '#ff9955',
    'var(--gold)',
    '#c5a44e',
    '#e8c85a',
];

interface Spark {
    id: number;
    angleDeg: number;
    dist: number;
    size: number;
    color: string;
    duration: number;
    delay: number;
}

function makeSparks(): Spark[] {
    return Array.from({ length: SPARK_COUNT }, (_, i) => {
        const base = (360 / SPARK_COUNT) * i;
        return {
            id: i,
            angleDeg: base + (Math.random() - 0.5) * 25,
            dist: 70 + Math.random() * 110,
            size: 4 + Math.random() * 5,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            duration: 550 + Math.random() * 500,
            delay: Math.random() * 120,
        };
    });
}

interface AttackEffectProps {
    onDone: () => void;
}

export const AttackEffect: React.FC<AttackEffectProps> = ({ onDone }) => {
    const [sparks] = useState<Spark[]>(makeSparks);

    useEffect(() => {
        // Tremor: add class to body, remove after animation
        document.body.classList.add('tremor');
        const tremorTimer = setTimeout(() => document.body.classList.remove('tremor'), 500);

        // Cleanup effect after all particles finish
        const doneTimer = setTimeout(onDone, 1600);

        return () => {
            clearTimeout(tremorTimer);
            clearTimeout(doneTimer);
            document.body.classList.remove('tremor');
        };
    }, [onDone]);

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 9999,
            }}
        >
            {/* Origin at viewport center */}
            <div style={{ position: 'absolute', left: '50%', top: '50%' }}>
                {/* Shockwave ring 1 — ember */}
                <div
                    style={{
                        position: 'absolute',
                        width: 80,
                        height: 80,
                        borderRadius: '50%',
                        border: '2.5px solid var(--ember)',
                        animation: 'shockwave 0.65s ease-out forwards',
                    }}
                />
                {/* Shockwave ring 2 — gold, slight delay */}
                <div
                    style={{
                        position: 'absolute',
                        width: 60,
                        height: 60,
                        borderRadius: '50%',
                        border: '1.5px solid rgba(197,164,78,0.7)',
                        animation: 'shockwave 0.75s 0.09s ease-out forwards',
                    }}
                />

                {/* Sparks: rotation wrapper + translateX inner */}
                {sparks.map(s => (
                    <div
                        key={s.id}
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            transform: `rotate(${s.angleDeg}deg)`,
                        }}
                    >
                        <div
                            style={{
                                width: s.size,
                                height: s.size,
                                borderRadius: '50%',
                                background: s.color,
                                boxShadow: `0 0 ${s.size * 2}px ${s.color}`,
                                animation: `sparkShoot ${s.duration}ms ${s.delay}ms ease-out forwards`,
                                ['--dist' as string]: `${s.dist}px`,
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};
