// components/Character/CharacterSheetPreview.tsx
import React from 'react';
import type { Attributes } from '@signarank/client';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';
import { useCharacterAttributes } from '@hooks/useCharacterAttributes';
import { AvatarDropzone } from './AvatarDropzone';

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

const NAME_MAX_LENGTH = 24;

export interface CharacterSheetProgress {
    contractId: string;
    state: PendingCharacterState;
    elapsedMs: number;
}

export interface CharacterSheetEditable {
    onNameChange: (name: string) => void;
    onDescriptionChange: (description: string) => void;
    onAvatarFile: (file: File) => void;
    avatarUploading: boolean;
    avatarError: string | null;
    avatarNotice?: string | null;
    disabled?: boolean;
}

export interface CharacterSheetPreviewProps {
    name: string;
    description: string;
    avatarUrl: string | null;
    /**
     * Presence turns the identity block (portrait/name/description) into a
     * live form: drag-and-drop portrait upload, inline name/description
     * editing. Omitted on the materializing page, where the character is
     * already composed and immutable.
     */
    editable?: CharacterSheetEditable;
    /**
     * Presence switches the card into "materializing" mode: renders the
     * rune-node progress stepper and shimmers the attribute placeholders
     * instead of showing them as flatly, permanently unknown. Omitted on the
     * create form, where nothing is in progress on-chain yet.
     */
    progress?: CharacterSheetProgress;
}

const fadeIn = (delayMs: number): React.CSSProperties => ({
    animation: 'fadeUp 0.5s ease-out both',
    animationDelay: `${delayMs}ms`,
});

export const CharacterSheetPreview: React.FC<CharacterSheetPreviewProps> = ({
    name,
    description,
    avatarUrl,
    editable,
    progress,
}) => {
    const { attributes } = useCharacterAttributes(progress?.contractId ?? null, progress?.state ?? 'pending');
    const isResolving = !!progress && progress.state !== 'live';
    const stepIndex = progress ? STEP_INDEX[progress.state] : -1;

    return (
        <div className="glass-static overflow-hidden p-6 relative">
            {/* Corner sigils — a sealed-plaque motif, echoes the diamond glyph in .section-label */}
            <span className="absolute top-2 left-2 text-[0.5rem] text-[var(--gold-dim)] select-none">◆</span>
            <span className="absolute top-2 right-2 text-[0.5rem] text-[var(--gold-dim)] select-none">◆</span>
            <span className="absolute bottom-2 left-2 text-[0.5rem] text-[var(--gold-dim)] select-none">◆</span>
            <span className="absolute bottom-2 right-2 text-[0.5rem] text-[var(--gold-dim)] select-none">◆</span>

            <div className="flex justify-center mb-4" style={fadeIn(0)}>
                {editable ? (
                    <AvatarDropzone
                        previewUrl={avatarUrl}
                        uploading={editable.avatarUploading}
                        error={editable.avatarError}
                        onFile={editable.onAvatarFile}
                    />
                ) : avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={name || 'Character avatar'}
                        className="w-32 h-32 rounded-full object-cover border border-[var(--gold-dim)]"
                    />
                ) : (
                    <div className="w-32 h-32 rounded-full border border-dashed border-[var(--glass-border)]" />
                )}
            </div>

            {editable?.avatarNotice && (
                <p className="text-center text-[0.7rem] text-[var(--text-faint)] mb-3" style={fadeIn(0)}>
                    {editable.avatarNotice}
                </p>
            )}

            <div className="text-center mb-1" style={fadeIn(60)}>
                {editable ? (
                    <input
                        type="text"
                        value={name}
                        maxLength={NAME_MAX_LENGTH}
                        disabled={editable.disabled}
                        onChange={e => editable.onNameChange(e.target.value)}
                        placeholder="Sir Reginald"
                        className="w-full text-center bg-transparent border-0 border-b border-transparent focus:border-[var(--gold)] outline-none text-[1.15rem] text-[var(--text)] pb-1 transition-colors duration-200 placeholder:text-[var(--text-faint)]"
                        style={{ fontFamily: "'Cinzel', serif", fontWeight: 600 }}
                    />
                ) : (
                    <h4 className="text-[var(--text)] m-0 truncate">{name || 'Unnamed Character'}</h4>
                )}
                {editable && (
                    <span
                        className="text-[0.6rem] text-[var(--text-faint)]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                        {name.length}/{NAME_MAX_LENGTH}
                    </span>
                )}
            </div>

            <div className="text-center mb-5" style={fadeIn(110)}>
                {editable ? (
                    <textarea
                        value={description}
                        disabled={editable.disabled}
                        onChange={e => editable.onDescriptionChange(e.target.value)}
                        placeholder="A wandering knight seeking glory."
                        rows={2}
                        className="w-full text-center bg-transparent border-0 border-b border-transparent focus:border-[var(--gold-dim)] outline-none resize-none text-[0.8rem] text-[var(--text-dim)] italic pb-1 transition-colors duration-200 placeholder:text-[var(--text-faint)]"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    />
                ) : (
                    description && (
                        <p className="text-[0.8rem] text-[var(--text-dim)] italic m-0 line-clamp-2">{description}</p>
                    )
                )}
            </div>

            {/* Stat plaque: Level / HP / XP — Level and XP are deterministic pre-init
                (a freshly rolled character is always level 1 with 0 XP); HP's base
                is fixed but the stamina-derived bonus stays unresolved here. */}
            <div
                className="flex items-stretch justify-center gap-4 mb-5 py-2.5"
                style={{ ...fadeIn(160), borderTop: '1px solid var(--glass-border)', borderBottom: '1px solid var(--glass-border)' }}
            >
                {[
                    { label: 'LVL', value: '1' },
                    { label: 'HP', value: '100', suffix: '+?' },
                    { label: 'XP', value: '0' },
                ].map((stat, i) => (
                    <React.Fragment key={stat.label}>
                        {i > 0 && <div className="w-px bg-[var(--glass-border)]" />}
                        <div className="flex flex-col items-center min-w-[3.2rem]">
                            <span
                                className="text-[0.55rem] tracking-[0.15em] text-[var(--text-faint)] mb-0.5"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                {stat.label}
                            </span>
                            <span className="text-[0.95rem] font-semibold text-[var(--gold)]">
                                {stat.value}
                                {stat.suffix && (
                                    <span className="text-[0.65rem] font-normal text-[var(--text-faint)]">
                                        {stat.suffix}
                                    </span>
                                )}
                            </span>
                        </div>
                    </React.Fragment>
                ))}
            </div>

            <div style={fadeIn(210)}>
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-[0.5rem] text-[var(--gold)]">◆</span>
                    <span
                        className="text-[0.6rem] font-semibold tracking-[0.2em] uppercase text-[var(--gold)]"
                        style={{ fontFamily: "'Cinzel', serif" }}
                    >
                        Attributes
                    </span>
                    <span
                        className="flex-1 h-px"
                        style={{ background: 'linear-gradient(90deg, var(--gold-dim), transparent)' }}
                    />
                </div>
                <ul className="flex flex-col gap-2 mb-5">
                    {ATTRIBUTE_ROWS.map(row => (
                        <li
                            key={row.key}
                            className="flex items-center justify-between text-[0.75rem] text-[var(--text-dim)]"
                        >
                            <span>{row.label}</span>
                            {attributes ? (
                                <span className="w-6 h-6 rounded-full flex items-center justify-center text-[0.7rem] font-semibold text-[var(--gold)] bg-[rgba(197,164,78,0.12)] border border-[var(--gold-dim)]">
                                    {attributes[row.key]}
                                </span>
                            ) : (
                                <span
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[0.7rem] text-[var(--text-faint)] border border-dashed border-[var(--glass-border)]"
                                    style={isResolving ? { animation: 'breathe 2s ease-in-out infinite' } : undefined}
                                >
                                    ?
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            </div>

            {progress && (
                <div style={fadeIn(260)}>
                    <div className="flex items-center mb-2">
                        {STEP_LABELS.map((label, i) => (
                            <React.Fragment key={label}>
                                {i > 0 && (
                                    <div
                                        className="flex-1 h-px transition-colors duration-300"
                                        style={{ background: i <= stepIndex ? 'var(--gold)' : 'var(--glass-border)' }}
                                    />
                                )}
                                <div
                                    title={label}
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors duration-300"
                                    style={{
                                        background: i <= stepIndex ? 'var(--gold)' : 'transparent',
                                        border: `1px solid ${i <= stepIndex ? 'var(--gold)' : 'var(--glass-border)'}`,
                                    }}
                                />
                            </React.Fragment>
                        ))}
                    </div>
                    <p className="text-[0.7rem] text-[var(--text-faint)] m-0 text-center">
                        {Math.floor(progress.elapsedMs / 60000)}m {Math.floor((progress.elapsedMs % 60000) / 1000)}s
                        elapsed
                    </p>
                </div>
            )}
        </div>
    );
};

export default CharacterSheetPreview;
