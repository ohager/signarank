// components/Character/CharacterCreateForm.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { Address } from '@signumjs/core';
import { Amount } from '@signumjs/util';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { useTokenBalances } from '@hooks/useTokenBalances';
import { useCharacterCreation, type CreationStep } from '@hooks/useCharacterCreation';
import { usePendingCharacters } from '@hooks/usePendingCharacters';
import { checkImageConstraints, cropAndResizeToDataUrl, type UploadedAvatar } from '@lib/character/avatarImage';
import { CharacterCreationCostsPlanck } from '@lib/character/constants';
import { loadDraft, clearDraft, type PendingCharacter } from '@lib/character/pendingCharacters';
import { CharacterSheetPreview } from './CharacterSheetPreview';

const NAME_MAX_LENGTH = 24;
// deploy fee (1) + funding fee (0.02), matches useCharacterCreation/useCharacterFunding
const NETWORK_FEE_ESTIMATE_SIGNA = 1.02;

const STEP_LABEL: Record<CreationStep, string> = {
    idle: 'Preparing...',
    'awaiting-deploy-signature': 'Step 1 of 2: Approve character deployment in your wallet',
    'awaiting-funding-signature': 'Step 2 of 2: Approve funding transaction in your wallet',
};

export const CharacterCreateForm: React.FC = () => {
    const router = useRouter();
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const accountId = useMemo(() => {
        if (!connectedAccount) return null;
        try {
            return Address.fromPublicKey(connectedAccount).getNumericId();
        } catch {
            return null;
        }
    }, [connectedAccount]);

    const { signaBalance } = useTokenBalances(accountId, []);
    const { create, creating, creationStep } = useCharacterCreation();
    const pendingCharacters = usePendingCharacters(connectedAccount);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [avatar, setAvatar] = useState<UploadedAvatar | null>(null);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | undefined>(undefined);

    // Resume after a mobile wallet redirect for the deploy signature. The
    // funding signature's redirect now resolves on /character/[contractId].
    useEffect(() => {
        if (!router.isReady || !connectedAccount) return;
        const { mobileCharacterStatus, mobileCharacterTxId } = router.query;
        if (!mobileCharacterStatus) return;

        const cleanQuery = () => {
            const { mobileCharacterStatus: _s, mobileCharacterStep: _st, mobileCharacterTxId: _t, ...rest } =
                router.query;
            router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
        };

        if (mobileCharacterStatus !== 'success') {
            setSubmitError('Signing was rejected or failed. Please try again.');
            cleanQuery();
            return;
        }

        const draft = loadDraft(connectedAccount);
        const deployedContractId = mobileCharacterTxId as string;
        if (draft) {
            pendingCharacters.upsert({
                contractId: deployedContractId,
                tx1Id: deployedContractId,
                name: draft.name,
                description: draft.description,
                avatarCid: draft.avatarCid,
                avatarMime: draft.avatarMime,
                avatarUrl: draft.avatarUrl,
                submittedAt: Date.now(),
                state: 'needs_funding',
            });
            clearDraft(connectedAccount);
        }
        cleanQuery();
        router.push(`/character/${deployedContractId}`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, connectedAccount]);

    const handleFile = useCallback(async (file: File) => {
        setAvatarError(null);
        setAvatarNotice(null);
        setAvatarUploading(true);
        try {
            const bitmap = await createImageBitmap(file);
            const { needsResize, needsCompress } = checkImageConstraints({
                width: bitmap.width,
                height: bitmap.height,
                sizeBytes: file.size,
            });
            if (needsResize && needsCompress) {
                setAvatarNotice('Image was resized and compressed to fit.');
            } else if (needsResize) {
                setAvatarNotice('Image was resized to fit.');
            } else if (needsCompress) {
                setAvatarNotice('Image was compressed to fit.');
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
            setAvatar(uploaded);
        } catch (e) {
            setAvatarError(e instanceof Error ? e.message : 'Could not process image');
            setPreviewUrl(null);
            setAvatar(null);
        } finally {
            setAvatarUploading(false);
        }
    }, []);

    const handleSubmit = useCallback(async () => {
        if (!connectedAccount || !avatar) return;
        setSubmitError(undefined);

        const result = await create(
            { name, description },
            { name, description, avatarCid: avatar.ipfsCid, avatarMime: avatar.mimeType, avatarUrl: avatar.url },
        );

        if (!result.success) {
            if (!result.cancelled) setSubmitError(result.error || 'Character creation failed');
            return;
        }

        if (!result.contractId) return;

        const entry: PendingCharacter = {
            contractId: result.contractId,
            tx1Id: result.tx1Id || result.contractId,
            tx1FullHash: result.tx1FullHash,
            tx2Id: result.tx2Id,
            name,
            description,
            avatarCid: avatar.ipfsCid,
            avatarMime: avatar.mimeType,
            avatarUrl: avatar.url,
            submittedAt: Date.now(),
            state: 'deployed',
        };
        pendingCharacters.upsert(entry);
        router.push(`/character/${result.contractId}`);
    }, [connectedAccount, avatar, name, description, create, pendingCharacters, router]);

    if (!connectedAccount) {
        return (
            <div className="glass-static overflow-hidden p-8 text-center">
                <p className="text-[var(--text-dim)] text-[0.9rem]">Connect your wallet to create a character.</p>
            </div>
        );
    }

    const rechargeSigna = parseFloat(Amount.fromPlanck(CharacterCreationCostsPlanck).getSigna());
    const totalRequired = rechargeSigna + NETWORK_FEE_ESTIMATE_SIGNA;
    const insufficientFunds = totalRequired > signaBalance;
    const nameValid = name.trim().length > 0 && name.length <= NAME_MAX_LENGTH;
    const canSubmit = nameValid && !!avatar && !avatarUploading && !insufficientFunds && !creating;

    return (
        <div className="flex flex-col gap-4">
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
                    disabled={creating}
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
                    disabled={creating}
                />

                <label className="block text-[var(--text-faint)] text-[0.65rem] uppercase tracking-[0.1em] mb-2">
                    Avatar
                </label>
                {avatarNotice && <p className="text-[0.7rem] text-[var(--text-faint)] mb-2">{avatarNotice}</p>}
                {avatarError && (
                    <div
                        className="mb-3 py-2.5 px-3 rounded-sm text-[0.8rem]"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                    >
                        {avatarError}
                    </div>
                )}
                <input
                    type="file"
                    accept="image/*"
                    disabled={avatarUploading || creating}
                    onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) void handleFile(file);
                    }}
                    className="block w-full text-[0.8rem] text-[var(--text-dim)] mb-1"
                />
                {avatarUploading && <p className="text-[0.75rem] text-[var(--text-dim)]">Uploading...</p>}
            </div>

            <CharacterSheetPreview name={name} description={description} avatarUrl={avatar?.url ?? previewUrl} />

            <div className="glass-static overflow-hidden p-5">
                <div
                    className="mb-4 py-2.5 px-3 rounded-sm text-[0.75rem]"
                    style={{ background: 'rgba(197,164,78,0.04)', border: '1px solid rgba(197,164,78,0.12)' }}
                >
                    <p className="m-0">Character recharge: {rechargeSigna} SIGNA</p>
                    <p className="m-0">Estimated network fees: {NETWORK_FEE_ESTIMATE_SIGNA} SIGNA</p>
                    <p className="m-0 font-semibold">Total: {totalRequired.toFixed(2)} SIGNA</p>
                </div>

                {insufficientFunds && (
                    <div
                        className="mb-4 py-2.5 px-3 rounded-sm text-[0.8rem]"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                    >
                        Insufficient balance. You have {signaBalance.toFixed(2)} SIGNA, need{' '}
                        {totalRequired.toFixed(2)} SIGNA.
                    </div>
                )}

                {submitError && (
                    <div
                        className="mb-4 py-2.5 px-3 rounded-sm text-[0.8rem]"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                    >
                        {submitError}
                    </div>
                )}

                {creating ? (
                    <p className="text-center text-[0.85rem] text-[var(--text)]">{STEP_LABEL[creationStep]}</p>
                ) : (
                    <button
                        className="w-full py-3 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                        disabled={!canSubmit}
                        onClick={handleSubmit}
                    >
                        Create Character
                    </button>
                )}
            </div>
        </div>
    );
};

export default CharacterCreateForm;
