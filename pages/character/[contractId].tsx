// pages/character/[contractId].tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Page from '@components/Page';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { usePendingCharacters } from '@hooks/usePendingCharacters';
import { useCharacterCreationProgress } from '@hooks/useCharacterCreationProgress';
import { useCharacterFunding } from '@hooks/useCharacterFunding';
import { CharacterSheetPreview } from '@components/Character/CharacterSheetPreview';
import { CreationTracker } from '@components/Character/CreationTracker';
import type { PendingCharacterState } from '@lib/character/pendingCharacters';

const STATE_COPY: Record<PendingCharacterState, string> = {
    pending: 'Broadcasting both transactions...',
    deployed: 'Contract deployed on-chain. Waiting for funding to settle...',
    funding_settled: 'Funded. Waiting for the character to wake up...',
    live: 'Your character is alive!',
    needs_funding: 'Waiting for funding...',
    failed: 'Something went wrong.',
};

const WORST_CASE_MS = 8 * 60 * 1000;

const CharacterProgressPage: React.FC = () => {
    const router = useRouter();
    const contractId = typeof router.query.contractId === 'string' ? router.query.contractId : null;
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const pendingCharacters = usePendingCharacters(connectedAccount);
    const { fund, funding } = useCharacterFunding();
    const [fundError, setFundError] = useState<string | undefined>(undefined);

    const entry = contractId ? pendingCharacters.characters.find(c => c.contractId === contractId) : undefined;
    const canPoll = !!entry?.tx1Id && !!entry?.tx2Id;

    const { state, elapsedMs } = useCharacterCreationProgress(entry?.tx1Id ?? null, entry?.tx2Id ?? null);
    const displayState: PendingCharacterState = canPoll ? state : entry?.state ?? 'pending';

    // Resume after a mobile wallet redirect for the funding signature.
    useEffect(() => {
        if (!router.isReady || !connectedAccount || !contractId) return;
        const { mobileCharacterStatus, mobileCharacterTxId } = router.query;
        if (!mobileCharacterStatus) return;

        const cleanQuery = () => {
            const { mobileCharacterStatus: _s, mobileCharacterStep: _st, mobileCharacterTxId: _t, ...rest } =
                router.query;
            router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
        };

        if (mobileCharacterStatus !== 'success') {
            setFundError('Signing was rejected or failed. Please try again.');
            cleanQuery();
            return;
        }

        pendingCharacters.update(contractId, { tx2Id: mobileCharacterTxId as string, state: 'deployed' });
        cleanQuery();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, connectedAccount, contractId]);

    const handleFund = useCallback(async () => {
        if (!contractId) return;
        setFundError(undefined);
        const result = await fund(contractId);
        if (!result.success) {
            if (!result.cancelled) {
                const error = result.error || 'Funding failed';
                setFundError(error);
                // Persist the failure so it survives navigation and the
                // header badge can flip to its "needs attention" state —
                // a plain local error (what the old wizard did) disappears
                // the moment the user leaves this page.
                pendingCharacters.update(contractId, { state: 'failed', error });
            }
            return;
        }
        pendingCharacters.update(contractId, { tx2Id: result.txId, state: 'deployed' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contractId, fund]);

    if (!connectedAccount) {
        return (
            <Page title="Character - SIGNArank">
                <div className="content max-w-lg mx-auto py-8 px-4">
                    <div className="glass-static overflow-hidden p-8 text-center">
                        <p className="text-[var(--text-dim)] text-[0.9rem]">
                            Connect your wallet to view this character.
                        </p>
                    </div>
                </div>
            </Page>
        );
    }

    if (!entry) {
        return (
            <Page title="Character - SIGNArank">
                <div className="content max-w-lg mx-auto py-8 px-4">
                    <div className="glass-static overflow-hidden p-8 text-center">
                        <p className="text-[var(--text-dim)] text-[0.9rem]">
                            No in-progress character found for this id. It may already be live — a full character
                            dashboard is coming soon.
                        </p>
                    </div>
                </div>
            </Page>
        );
    }

    return (
        <Page title={`${entry.name} - SIGNArank`} description={`Watch ${entry.name} come to life on SignaRank.`}>
            <div className="content max-w-lg mx-auto py-8 px-4 flex flex-col gap-4">
                {canPoll && <CreationTracker accountId={connectedAccount} character={entry} />}

                <CharacterSheetPreview
                    name={entry.name}
                    description={entry.description}
                    avatarUrl={entry.avatarUrl}
                    progress={{ contractId: entry.contractId, state: displayState, elapsedMs }}
                />

                <div className="glass-static overflow-hidden p-5 text-center">
                    {fundError ? (
                        <p className="text-[0.85rem]" style={{ color: '#ef4444' }}>
                            {fundError}
                        </p>
                    ) : (
                        <>
                            <p className="text-[0.9rem] text-[var(--text)] mb-2">{STATE_COPY[displayState]}</p>
                            {displayState !== 'live' && displayState !== 'needs_funding' && (
                                <p className="text-[0.7rem] text-[var(--text-faint)]">
                                    {Math.floor(elapsedMs / 60000)}m {Math.floor((elapsedMs % 60000) / 1000)}s
                                    elapsed (typically ~4-8 min)
                                </p>
                            )}
                            {elapsedMs > WORST_CASE_MS && displayState !== 'live' && (
                                <p className="text-[0.7rem] mt-2" style={{ color: 'var(--ember)' }}>
                                    This is taking longer than usual — the network may be congested. Your character
                                    is safe; check back here once you have the link.
                                </p>
                            )}
                        </>
                    )}

                    {displayState === 'needs_funding' && (
                        <button
                            className="mt-4 py-3 px-6 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                            disabled={funding}
                            onClick={handleFund}
                        >
                            {funding ? 'Confirm in wallet...' : 'Continue: Fund Character'}
                        </button>
                    )}

                    {displayState === 'live' && (
                        <button
                            className="mt-4 py-3 px-6 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-not-allowed opacity-60"
                            style={{ background: 'linear-gradient(135deg, var(--gold), #a5843a)' }}
                            disabled
                            title="Character dashboard coming soon"
                        >
                            Character Sheet — Coming Soon
                        </button>
                    )}
                </div>
            </div>
        </Page>
    );
};

export default CharacterProgressPage;
