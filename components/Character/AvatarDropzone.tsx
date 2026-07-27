// components/Character/AvatarDropzone.tsx
import React, { useCallback, useRef, useState } from 'react';

export interface AvatarDropzoneProps {
    previewUrl: string | null;
    uploading: boolean;
    error: string | null;
    onFile: (file: File) => void;
}

/**
 * A circular, self-contained portrait slot: drag a file onto it or click it
 * to browse. Lives inside CharacterSheetPreview's avatar position — the
 * upload target IS the avatar, there's no separate file input row.
 */
export const AvatarDropzone: React.FC<AvatarDropzoneProps> = ({ previewUrl, uploading, error, onFile }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragActive, setDragActive] = useState(false);

    const openPicker = useCallback(() => {
        if (!uploading) inputRef.current?.click();
    }, [uploading]);

    const handleDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onFile(file);
        },
        [onFile],
    );

    const ringColor = error
        ? 'var(--ember)'
        : dragActive
          ? 'var(--gold-bright)'
          : previewUrl
            ? 'var(--gold-dim)'
            : 'var(--glass-border)';

    return (
        <div className="flex flex-col items-center">
            <div
                role="button"
                tabIndex={0}
                aria-label="Upload character portrait"
                onClick={openPicker}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openPicker()}
                onDragOver={e => {
                    e.preventDefault();
                    setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                className="group relative w-32 h-32 rounded-full cursor-pointer transition-shadow duration-200"
                style={{
                    border: `1px dashed ${previewUrl ? 'transparent' : ringColor}`,
                    boxShadow: dragActive
                        ? '0 0 0 3px rgba(232,200,90,0.18), 0 0 24px rgba(232,200,90,0.25)'
                        : 'none',
                }}
            >
                {/* Sigil ring */}
                <div
                    className="absolute inset-[-4px] rounded-full pointer-events-none transition-colors duration-200"
                    style={{ border: `1px solid ${previewUrl ? ringColor : 'transparent'}` }}
                />

                {previewUrl ? (
                    <>
                        <img
                            src={previewUrl}
                            alt="Character portrait"
                            className="w-full h-full rounded-full object-cover"
                        />
                        <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/0 group-hover:bg-black/55 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <span
                                className="text-[0.6rem] uppercase tracking-[0.1em] text-[var(--gold-bright)]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                            >
                                Change Portrait
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[var(--gold-dim)]">
                            <path
                                d="M12 16V4M12 4L7 9M12 4L17 9"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path
                                d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span className="text-[0.6rem] leading-tight text-[var(--text-faint)]">
                            Drop image or
                            <br />
                            click to upload
                        </span>
                    </div>
                )}

                {uploading && (
                    <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50">
                        <div className="w-7 h-7 rounded-full border-2 border-[var(--gold-dim)] border-t-[var(--gold)] animate-spin" />
                    </div>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) onFile(file);
                    e.target.value = '';
                }}
            />

            {error && <p className="mt-2 text-[0.7rem] text-center" style={{ color: 'var(--ember)' }}>{error}</p>}
        </div>
    );
};

export default AvatarDropzone;
