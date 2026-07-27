import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Address } from '@signumjs/core';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { useTokenBalances } from '@hooks/useTokenBalances';
import { useCharacterCreation } from '@hooks/useCharacterCreation';
import { useCharacterFunding } from '@hooks/useCharacterFunding';
import {
    upsertPendingCharacter,
    updatePendingCharacter,
    getPendingCharacters,
    loadDraft,
    clearDraft,
    type PendingCharacter,
} from '@lib/character/pendingCharacters';
import NameDescriptionStep from './NameDescriptionStep';
import AvatarStep, { type UploadedAvatar } from './AvatarStep';
import ReviewStep from './ReviewStep';
import CreatingStep from './CreatingStep';
import ConfirmingStep from './ConfirmingStep';
import LiveStep from './LiveStep';

type WizardStep = 'name' | 'avatar' | 'review' | 'creating' | 'confirming' | 'live';

export const CharacterCreateWizard: React.FC = () => {
    const router = useRouter();
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const accountId = React.useMemo(() => {
        if (!connectedAccount) return null;
        try {
            return Address.fromPublicKey(connectedAccount).getNumericId();
        } catch {
            return null;
        }
    }, [connectedAccount]);

    const { signaBalance } = useTokenBalances(accountId, []);

    const [step, setStep] = useState<WizardStep>('name');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [avatar, setAvatar] = useState<UploadedAvatar | null>(null);
    const [contractId, setContractId] = useState<string | null>(null);
    const [tx1Id, setTx1Id] = useState<string | null>(null);
    const [tx2Id, setTx2Id] = useState<string | null>(null);
    const [creationError, setCreationError] = useState<string | undefined>(undefined);
    const [needsFundingAction, setNeedsFundingAction] = useState(false);

    const { create, creating, creationStep } = useCharacterCreation();
    const { fund, funding } = useCharacterFunding();

    // Resume after a mobile wallet redirect (deploy or fund signing).
    useEffect(() => {
        if (!router.isReady || !connectedAccount) return;
        const { mobileCharacterStatus, mobileCharacterStep, mobileCharacterTxId } = router.query;
        if (!mobileCharacterStatus) return;

        const cleanQuery = () => {
            const { mobileCharacterStatus: _s, mobileCharacterStep: _st, mobileCharacterTxId: _t, ...rest } = router.query;
            router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
        };

        if (mobileCharacterStatus !== 'success') {
            setCreationError('Signing was rejected or failed. Please try again.');
            setStep('review');
            cleanQuery();
            return;
        }

        if (mobileCharacterStep === 'deploy') {
            const draft = loadDraft(connectedAccount);
            const deployedContractId = mobileCharacterTxId as string;
            setContractId(deployedContractId);
            setTx1Id(deployedContractId);
            if (draft) {
                setName(draft.name);
                setDescription(draft.description);
                setAvatar({ ipfsCid: draft.avatarCid, mimeType: draft.avatarMime, url: draft.avatarUrl });
                upsertPendingCharacter(connectedAccount, {
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
            setNeedsFundingAction(true);
            setStep('creating');
        } else if (mobileCharacterStep === 'fund') {
            const fundTxId = mobileCharacterTxId as string;
            let resolvedContractId = contractId;

            if (!resolvedContractId) {
                // Fresh mount after the second mobile redirect (funding) wipes
                // React state entirely — recover which character we're
                // funding from the localStorage entry the deploy step wrote.
                const pending = getPendingCharacters(connectedAccount).find(c => c.state === 'needs_funding');
                if (pending) {
                    resolvedContractId = pending.contractId;
                    setContractId(pending.contractId);
                    setTx1Id(pending.tx1Id);
                    setName(pending.name);
                    setDescription(pending.description);
                    setAvatar({ ipfsCid: pending.avatarCid, mimeType: pending.avatarMime, url: pending.avatarUrl });
                }
            }

            if (resolvedContractId) {
                updatePendingCharacter(connectedAccount, resolvedContractId, {
                    tx2Id: fundTxId,
                    state: 'deployed',
                });
                setTx2Id(fundTxId);
                setNeedsFundingAction(false);
                setStep('confirming');
            } else {
                setCreationError('Could not find the character being funded. Please check your pending characters and try again.');
                setStep('name');
            }
        }

        cleanQuery();
    }, [router.isReady, connectedAccount]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleConfirmCreate = useCallback(async () => {
        if (!connectedAccount || !avatar) return;
        setStep('creating');
        setCreationError(undefined);

        const result = await create(
            { name, description },
            { name, description, avatarCid: avatar.ipfsCid, avatarMime: avatar.mimeType, avatarUrl: avatar.url },
        );

        if (!result.success) {
            if (result.cancelled) {
                setStep('review');
                return;
            }
            setCreationError(result.error || 'Character creation failed');
            return;
        }

        if (!result.contractId) return;

        setContractId(result.contractId);
        setTx1Id(result.tx1Id || result.contractId);
        setTx2Id(result.tx2Id || null);

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
        upsertPendingCharacter(connectedAccount, entry);
        setStep('confirming');
    }, [connectedAccount, avatar, name, description, create]);

    const handleFund = useCallback(async () => {
        if (!connectedAccount || !contractId) return;
        const result = await fund(contractId);
        if (!result.success) {
            if (!result.cancelled) setCreationError(result.error || 'Funding failed');
            return;
        }
        updatePendingCharacter(connectedAccount, contractId, { tx2Id: result.txId, state: 'deployed' });
        setTx2Id(result.txId || null);
        setNeedsFundingAction(false);
        setStep('confirming');
    }, [connectedAccount, contractId, fund]);

    if (!connectedAccount) {
        return (
            <div className="glass-static overflow-hidden p-8 text-center">
                <p className="text-[var(--text-dim)] text-[0.9rem]">Connect your wallet to create a character.</p>
            </div>
        );
    }

    switch (step) {
        case 'name':
            return (
                <NameDescriptionStep
                    initialName={name}
                    initialDescription={description}
                    onNext={(n, d) => {
                        setName(n);
                        setDescription(d);
                        setStep('avatar');
                    }}
                />
            );
        case 'avatar':
            return (
                <AvatarStep
                    onNext={a => {
                        setAvatar(a);
                        setStep('review');
                    }}
                    onBack={() => setStep('name')}
                />
            );
        case 'review':
            return avatar ? (
                <ReviewStep
                    name={name}
                    description={description}
                    avatar={avatar}
                    signaBalance={signaBalance}
                    onConfirm={handleConfirmCreate}
                    onBack={() => setStep('avatar')}
                />
            ) : null;
        case 'creating':
            return (
                <CreatingStep
                    creationStep={creationStep}
                    needsFundingAction={needsFundingAction}
                    funding={funding}
                    onFund={handleFund}
                    error={creationError}
                />
            );
        case 'confirming':
            return contractId && tx1Id && tx2Id ? (
                <ConfirmingStep
                    walletAccount={connectedAccount}
                    contractId={contractId}
                    tx1Id={tx1Id}
                    tx2Id={tx2Id}
                    onLive={() => setStep('live')}
                />
            ) : null;
        case 'live':
            return contractId ? <LiveStep contractId={contractId} name={name} /> : null;
        default:
            return null;
    }
};

export default CharacterCreateWizard;
