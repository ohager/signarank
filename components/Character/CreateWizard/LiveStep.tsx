import React from 'react';
import { useRouter } from 'next/router';

interface LiveStepProps {
    contractId: string;
    name: string;
}

export const LiveStep: React.FC<LiveStepProps> = ({ contractId, name }) => {
    const router = useRouter();

    return (
        <div className="glass-static overflow-hidden p-5 text-center">
            <p className="text-[0.9rem] text-[var(--text)] mb-4">
                {name} has been deployed. It will come to life once both transactions confirm (~4-8 minutes).
            </p>
            <button
                className="py-3 px-6 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer"
                style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                onClick={() => router.push(`/character/${contractId}`)}
            >
                View Character
            </button>
        </div>
    );
};

export default LiveStep;
