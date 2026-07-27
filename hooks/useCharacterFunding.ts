// hooks/useCharacterFunding.ts
import { useState, useCallback } from 'react';
import { Amount } from '@signumjs/util';
import { Signer } from '@signarank/client';
import { useAppContext } from '@hooks/useAppContext';
import { useSignumLedger } from '@hooks/useSignumLedger';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { useIsMobile } from '@hooks/useIsMobile';
import { CharacterCreationCostsPlanck } from '@lib/character/constants';

export interface FundResult {
    success: boolean;
    txId?: string;
    error?: string;
    cancelled?: boolean;
}

interface UseCharacterFundingResult {
    fund: (contractId: string) => Promise<FundResult>;
    funding: boolean;
}

export const useCharacterFunding = (): UseCharacterFundingResult => {
    const [funding, setFunding] = useState(false);
    const { Wallet, Ledger } = useAppContext();
    const ledger = useSignumLedger();
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const isMobile = useIsMobile();

    const fund = useCallback(
        async (contractId: string): Promise<FundResult> => {
            if (!ledger || !connectedAccount) {
                return { success: false, error: 'Wallet not connected' };
            }

            setFunding(true);
            try {
                const controller = new AbortController();

                const signer: Signer = {
                    getPublicKey: async () => connectedAccount,
                    sign: async (unsignedTransactionBytes: string, signal?: AbortSignal) => {
                        if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');

                        if (isMobile) {
                            const network = Ledger.Network.toLowerCase().includes('testnet') ? 'testnet' : 'mainnet';
                            const returnUrl = window.location.pathname + window.location.search;
                            const callbackUrl = `${window.location.origin}/wallet/character-signed?step=fund&returnUrl=${encodeURIComponent(returnUrl)}`;
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

                        return { fullHash: confirmed.fullHash, transaction: confirmed.transactionId } as any;
                    },
                };

                const senderPublicKey = await signer.getPublicKey();
                if (!senderPublicKey) {
                    return { success: false, error: 'Wallet has no public key' };
                }

                const unsignedTx = await ledger.transaction.sendAmountToSingleRecipient({
                    senderPublicKey,
                    feePlanck: Amount.fromSigna('0.02').getPlanck(),
                    amountPlanck: Amount.fromPlanck(CharacterCreationCostsPlanck).getPlanck(),
                    recipientId: contractId,
                });

                const signed = (await signer.sign(unsignedTx.unsignedTransactionBytes, controller.signal)) as any;

                return { success: true, txId: signed.transaction };
            } catch (e) {
                const isCancelled = e instanceof DOMException && e.name === 'AbortError';
                if (isCancelled) return { success: false, cancelled: true };
                const errorMessage = e instanceof Error ? e.message : 'Funding failed';
                return { success: false, error: errorMessage };
            } finally {
                setFunding(false);
            }
        },
        [ledger, connectedAccount, Wallet, Ledger, isMobile],
    );

    return { fund, funding };
};
