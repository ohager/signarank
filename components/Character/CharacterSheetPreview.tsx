// components/Character/CharacterSheetPreview.tsx
import React from 'react';
import type { Attributes } from '@signarank/client';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';
import { useCharacterAttributes } from '@hooks/useCharacterAttributes';

const ATTRIBUTE_ROWS: { key: keyof Attributes; label: string }[] = [
    { key: 'strength', label: 'Strength' },
    { key: 'stamina', label: 'Stamina' },
    { key: 'dexterity', label: 'Dexterity' },
    { key: 'luck', label: 'Luck' },
    { key: 'willpower', label: 'Willpower' },
];

const STEP_LABELS = ['Pending', 'Deployed', 'Funding settled', 'Live'];

const STEP_INDEX: Record<PendingCharacterState, number> = {
    pending: 0,
    deployed: 1,
    needs_funding: 1,
    funding_settled: 2,
    live: 3,
    failed: -1,
};

export interface CharacterSheetProgress {
    contractId: string;
    state: PendingCharacterState;
    elapsedMs: number;
}

export interface CharacterSheetPreviewProps {
    name: string;
    description: string;
    avatarUrl: string | null;
    /**
     * Presence switches the card into "materializing" mode: renders the
     * 4-dot progress stepper and shimmers the attribute placeholders instead
     * of showing them as flatly, permanently unknown. Omitted on the create
     * form, where nothing is in progress on-chain yet.
     */
    progress?: CharacterSheetProgress;
}

export const CharacterSheetPreview: React.FC<CharacterSheetPreviewProps> = ({
    name,
    description,
    avatarUrl,
    progress,
}) => {
    const { attributes } = useCharacterAttributes(progress?.contractId ?? null, progress?.state ?? 'pending');
    const isResolving = !!progress && progress.state !== 'live';
    const stepIndex = progress ? STEP_INDEX[progress.state] : -1;

    return (
        <div className="glass-static overflow-hidden p-5">
            <div className="flex items-center gap-4 mb-4">
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={name || 'Character avatar'}
                        className="w-16 h-16 rounded-full object-cover border border-[var(--gold-dim)] flex-shrink-0"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-full border border-dashed border-[var(--glass-border)] flex-shrink-0" />
                )}
                <div className="min-w-0">
                    <h4 className="text-[var(--text)] m-0 truncate">{name || 'Unnamed Character'}</h4>
                    {description && (
                        <p className="text-[0.75rem] text-[var(--text-dim)] m-0 line-clamp-2">{description}</p>
                    )}
                </div>
            </div>

            <ul className="flex flex-col gap-1.5 mb-4">
                {ATTRIBUTE_ROWS.map(row => (
                    <li
                        key={row.key}
                        className="flex items-center justify-between text-[0.75rem] text-[var(--text-dim)]"
                    >
                        <span>{row.label}</span>
                        {attributes ? (
                            <span className="text-[var(--gold)] font-semibold">{attributes[row.key]}</span>
                        ) : (
                            <span
                                className="text-[var(--text-faint)]"
                                style={isResolving ? { animation: 'breathe 2s ease-in-out infinite' } : undefined}
                            >
                                ?
                            </span>
                        )}
                    </li>
                ))}
            </ul>

            {progress && (
                <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                        {STEP_LABELS.map((label, i) => (
                            <div
                                key={label}
                                title={label}
                                className="flex-1 h-1 rounded-full"
                                style={{ background: i <= stepIndex ? 'var(--gold)' : 'var(--glass-border)' }}
                            />
                        ))}
                    </div>
                    <p className="text-[0.7rem] text-[var(--text-faint)] m-0">
                        {Math.floor(progress.elapsedMs / 60000)}m {Math.floor((progress.elapsedMs % 60000) / 1000)}s
                        elapsed
                    </p>
                </div>
            )}
        </div>
    );
};

export default CharacterSheetPreview;
