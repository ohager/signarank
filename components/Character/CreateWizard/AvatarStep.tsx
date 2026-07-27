import React, { useState, useCallback } from 'react';
import { checkImageConstraints, cropAndResizeToDataUrl } from '@lib/character/avatarImage';

export interface UploadedAvatar {
    ipfsCid: string;
    mimeType: string;
    url: string;
}

interface AvatarStepProps {
    onNext: (avatar: UploadedAvatar) => void;
    onBack: () => void;
}

export const AvatarStep: React.FC<AvatarStepProps> = ({ onNext, onBack }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [adjustedNotice, setAdjustedNotice] = useState<string | null>(null);

    const handleFile = useCallback(async (file: File) => {
        setError(null);
        setAdjustedNotice(null);
        setUploading(true);
        try {
            const bitmap = await createImageBitmap(file);
            const { needsResize, needsCompress } = checkImageConstraints({
                width: bitmap.width,
                height: bitmap.height,
                sizeBytes: file.size,
            });
            if (needsResize && needsCompress) {
                setAdjustedNotice('Image was resized and compressed to fit.');
            } else if (needsResize) {
                setAdjustedNotice('Image was resized to fit.');
            } else if (needsCompress) {
                setAdjustedNotice('Image was compressed to fit.');
            }

            const { dataUrl, mimeType } = await cropAndResizeToDataUrl(file);
            setPreviewUrl(dataUrl);

            const res = await fetch('/api/character/upload-avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataUrl, fileName: file.name || `avatar.${mimeType.split('/')[1]}` }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Upload failed');
            }

            const uploaded: UploadedAvatar = await res.json();
            onNext(uploaded);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not process image');
            setPreviewUrl(null);
        } finally {
            setUploading(false);
        }
    }, [onNext]);

    return (
        <div className="glass-static overflow-hidden p-5">
            {previewUrl && (
                <img src={previewUrl} alt="Avatar preview" className="w-32 h-32 rounded-full object-cover mx-auto mb-4" />
            )}

            {adjustedNotice && (
                <p className="text-center text-[0.7rem] text-[var(--text-faint)] mb-3">{adjustedNotice}</p>
            )}

            {error && (
                <div className="mb-4 py-2.5 px-3 rounded-sm text-[0.8rem]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                    {error}
                </div>
            )}

            <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void handleFile(file);
                }}
                className="block w-full text-[0.8rem] text-[var(--text-dim)] mb-4"
            />

            {uploading && <p className="text-[0.8rem] text-[var(--text-dim)] text-center">Uploading...</p>}

            <button
                className="text-[0.75rem] underline text-[var(--text-dim)] bg-transparent border-none cursor-pointer"
                onClick={onBack}
                disabled={uploading}
            >
                Back
            </button>
        </div>
    );
};

export default AvatarStep;
