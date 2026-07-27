import React, { useState } from 'react';

const NAME_MAX_LENGTH = 24;

interface NameDescriptionStepProps {
    initialName: string;
    initialDescription: string;
    onNext: (name: string, description: string) => void;
}

export const NameDescriptionStep: React.FC<NameDescriptionStepProps> = ({ initialName, initialDescription, onNext }) => {
    const [name, setName] = useState(initialName);
    const [description, setDescription] = useState(initialDescription);

    const canContinue = name.trim().length > 0 && name.length <= NAME_MAX_LENGTH;

    return (
        <div className="glass-static overflow-hidden p-5">
            <label className="block text-[var(--text-faint)] text-[0.65rem] uppercase tracking-[0.1em] mb-2">
                Character Name
                <span className="text-[var(--text-dim)] ml-2 normal-case tracking-normal">
                    ({name.length}/{NAME_MAX_LENGTH})
                </span>
            </label>
            <input
                type="text"
                className="w-full py-2.5 px-3 bg-[rgba(8,6,12,0.4)] border border-[var(--glass-border)] rounded-sm text-[var(--text)] text-[0.85rem] mb-4 focus:outline-none focus:border-[var(--gold)]"
                value={name}
                maxLength={NAME_MAX_LENGTH}
                onChange={e => setName(e.target.value)}
                placeholder="Sir Reginald"
            />

            <label className="block text-[var(--text-faint)] text-[0.65rem] uppercase tracking-[0.1em] mb-2">
                Description
            </label>
            <textarea
                className="w-full py-2.5 px-3 bg-[rgba(8,6,12,0.4)] border border-[var(--glass-border)] rounded-sm text-[var(--text)] text-[0.85rem] mb-4 focus:outline-none focus:border-[var(--gold)]"
                rows={3}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A wandering knight seeking glory."
            />

            <button
                className="w-full py-3 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                disabled={!canContinue}
                onClick={() => onNext(name.trim(), description.trim())}
            >
                Next: Avatar
            </button>
        </div>
    );
};

export default NameDescriptionStep;
