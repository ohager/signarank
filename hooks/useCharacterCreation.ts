// hooks/useCharacterCreation.ts
import { useState, useCallback } from 'react';
import { Player, Signer } from '@signarank/client';
import { useAppContext } from '@hooks/useAppContext';
import { useSignumLedger } from '@hooks/useSignumLedger';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { useIsMobile } from '@hooks/useIsMobile';
import { getCharacterContractReference, getGamemasterRegistryId } from '@lib/character/constants';
import { saveDraft, type CreationDraft } from '@lib/character/pendingCharacters';

export type CreationStep = 'idle' | 'awaiting-deploy-signature' | 'awaiting-funding-signature';

export interface CreateCharacterParams {
    name: string;
    description: string;
}

export interface CreationResult {
    success: boolean;
    /** Populated once the deploy tx is known — same value on desktop
     * (fully chained) and mobile (deploy-only, funding is a separate step). */
    contractId?: string;
    tx1Id?: string;
    tx1FullHash?: string;
    tx2Id?: string;
    /** True on mobile: deploy succeeded but funding still needs an explicit
     * second signature via useCharacterFunding().fund(contractId). */
    needsFunding?: boolean;
    error?: string;
    cancelled?: boolean;
}

interface UseCharacterCreationResult {
    create: (params: CreateCharacterParams, draft: CreationDraft) => Promise<CreationResult>;
    creating: boolean;
    creationStep: CreationStep;
}

export const useCharacterCreation = (): UseCharacterCreationResult => {
    const [creating, setCreating] = useState(false);
    const [creationStep, setCreationStep] = useState<CreationStep>('idle');
    const { Wallet, Ledger } = useAppContext();
    const ledger = useSignumLedger();
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const isMobile = useIsMobile();

    const create = useCallback(
        async (params: CreateCharacterParams, draft: CreationDraft): Promise<CreationResult> => {
            if (!ledger || !connectedAccount) {
                return { success: false, error: 'Wallet not connected' };
            }

            setCreating(true);
            setCreationStep('awaiting-deploy-signature');

            try {
                const controller = new AbortController();
                let signCallCount = 0;
                const signResults: any[] = [];

                const signer: Signer = {
                    getPublicKey: async () => connectedAccount,
                    sign: async (unsignedTransactionBytes: string, signal?: AbortSignal) => {
                        if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');
                        signCallCount += 1;
                        setCreationStep(signCallCount === 1 ? 'awaiting-deploy-signature' : 'awaiting-funding-signature');

                        if (isMobile) {
                            // Desktop-only atomic path never reaches a second
                            // sign() call on mobile (shouldChainChargeTransaction
                            // is false there), so this only ever fires once here.
                            saveDraft(connectedAccount, draft);
                            const network = Ledger.Network.toLowerCase().includes('testnet') ? 'testnet' : 'mainnet';
                            const returnUrl = window.location.pathname + window.location.search;
                            const callbackUrl = `${window.location.origin}/wallet/character-signed?step=deploy&returnUrl=${encodeURIComponent(returnUrl)}`;
                            Wallet.Mobile.sign({ unsignedTransactionBytes, callbackUrl, network });
                            return new Promise<never>(() => {});
                        }

                        let confirmed: any;
                        try {
                            confirmed = await Wallet.Extension.confirm(unsignedTransactionBytes);
                        } catch (e) {
                            const name: string = (e as any)?.name ?? '';
                            const msg: string = (e as any)?.message ?? (e as any)?.error ?? '';
                            const isUserDenial =
                                name === 'NotGrantedWalletError' || /cancel|reject|denied|abort|not.granted/i.test(msg);
                            if (isUserDenial) controller.abort();
                            throw new DOMException(isUserDenial ? 'cancelled' : msg || 'Signing failed', 'AbortError');
                        }

                        if (!confirmed) {
                            controller.abort();
                            throw new DOMException('cancelled', 'AbortError');
                        }

                        const result = { fullHash: confirmed.fullHash, transaction: confirmed.transactionId };
                        signResults.push(result);
                        return result as any;
                    },
                };

                const player = new Player({
                    Ledger: ledger,
                    Signer: signer,
                    accountId: connectedAccount,
                    gamemasterRegistryId: getGamemasterRegistryId(),
                    characterContractReference: getCharacterContractReference(),
                });

                const deployTx = await player.createContract({
                    name: params.name,
                    description: params.description,
                    shouldChainChargeTransaction: !isMobile,
                });

                const contractId = deployTx.transaction;

                if (isMobile) {
                    // Mobile navigated away before this line — unreachable in
                    // that branch; kept only so desktop/extension flows below
                    // are typed consistently. Desktop resumes here directly.
                    return { success: true, contractId, tx1Id: contractId, needsFunding: true };
                }

                return {
                    success: true,
                    contractId,
                    tx1Id: signResults[0]?.transaction,
                    tx1FullHash: signResults[0]?.fullHash,
                    tx2Id: signResults[1]?.transaction,
                    needsFunding: false,
                };
            } catch (e) {
                const isCancelled = e instanceof DOMException && e.name === 'AbortError';
                if (isCancelled) return { success: false, cancelled: true };
                const errorMessage = e instanceof Error ? e.message : 'Character creation failed';
                return { success: false, error: errorMessage };
            } finally {
                setCreating(false);
                setCreationStep('idle');
            }
        },
        [ledger, connectedAccount, Wallet, Ledger, isMobile],
    );

    return { create, creating, creationStep };
};
