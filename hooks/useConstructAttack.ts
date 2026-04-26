import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Amount, ChainValue } from '@signumjs/util';
import { Player, Signer } from '@signarank/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@hooks/useAppContext';
import { useSignumLedger } from '@hooks/useSignumLedger';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { useIsMobile } from '@hooks/useIsMobile';
import { AttackParams, AttackResult } from '@lib/construct/types';

interface UseConstructAttackResult {
    attack: (params: AttackParams) => Promise<AttackResult>;
    attacking: boolean;
    lastResult: AttackResult | null;
    reset: () => void;
}

export const useConstructAttack = (): UseConstructAttackResult => {
    const [attacking, setAttacking] = useState(false);
    const [lastResult, setLastResult] = useState<AttackResult | null>(null);

    const { Wallet, Ledger } = useAppContext();
    const ledger = useSignumLedger();
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const queryClient = useQueryClient();
    const isMobile = useIsMobile();
    const router = useRouter();

    useEffect(() => {
        if (!router.isReady) return;
        const { mobileAttackStatus, mobileAttackTxId } = router.query;
        if (!mobileAttackStatus) return;

        if (mobileAttackStatus === 'success') {
            setLastResult({
                success: true,
                txId: typeof mobileAttackTxId === 'string' ? mobileAttackTxId : undefined,
            });
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['pendingAttacks'] });
                queryClient.invalidateQueries({ queryKey: ['attackHistory'] });
                queryClient.invalidateQueries({ queryKey: ['construct'] });
            }, 3000);
        } else if (mobileAttackStatus !== 'rejected') {
            setLastResult({ success: false, error: 'Mobile signing failed' });
        }

        const { mobileAttackStatus: _s, mobileAttackTxId: _t, ...restQuery } = router.query;
        router.replace({ pathname: router.pathname, query: restQuery }, undefined, { shallow: true });
    }, [router.isReady]);

    const reset = useCallback(() => {
        setLastResult(null);
    }, []);

    const attack = useCallback(async (params: AttackParams): Promise<AttackResult> => {
        if (!ledger || !connectedAccount) {
            const result: AttackResult = {
                success: false,
                error: 'Wallet not connected',
            };
            setLastResult(result);
            return result;
        }

        setAttacking(true);
        setLastResult(null);

        try {
            const { contractId, signaAmount } = params;

            const controller = new AbortController();

            const signer: Signer = {
                getPublicKey: async () => connectedAccount,
                sign: async (unsignedTransactionBytes: string, signal?: AbortSignal) => {
                    if (signal?.aborted) throw new DOMException('cancelled', 'AbortError');

                    if (isMobile) {
                        const network = Ledger.Network.toLowerCase().includes('testnet') ? 'testnet' : 'mainnet';
                        const returnUrl = window.location.pathname + window.location.search;
                        const callbackUrl = `${window.location.origin}/wallet/signed?returnUrl=${encodeURIComponent(returnUrl)}`;
                        Wallet.Mobile.sign({ unsignedTransactionBytes, callbackUrl, network });
                        return new Promise<never>(() => {});
                    }

                    let confirmed: any;
                    try {
                        confirmed = await Wallet.Extension.confirm(unsignedTransactionBytes);
                    } catch (e) {
                        const name: string = (e as any)?.name ?? '';
                        const msg: string  = (e as any)?.message ?? (e as any)?.error ?? '';
                        const isUserDenial = name === 'NotGrantedWalletError'
                            || /cancel|reject|denied|abort|not.granted/i.test(msg);
                        if (isUserDenial) controller.abort();
                        throw new DOMException(isUserDenial ? 'cancelled' : (msg || 'Signing failed'), 'AbortError');
                    }

                    if (!confirmed) {
                        controller.abort();
                        throw new DOMException('cancelled', 'AbortError');
                    }

                    return {
                        fullHash: confirmed.fullHash,
                        transaction: confirmed.transactionId,
                    } as any;
                },
            };

            const player = new Player({
                Ledger: ledger,
                Signer: signer,
                accountId: connectedAccount,
            });

            const powerUps = (params.tokens ?? []).map(t => ({
                assetId: t.tokenId,
                value: ChainValue.create(t.decimals).setCompound(t.quantity),
            }));

            const txResult = await player.attackConstruct({
                targetConstruct: contractId,
                force: Amount.fromSigna(signaAmount),
                powerUps,
                signal: controller.signal,
            });

            const result: AttackResult = {
                success: true,
                txId: (txResult as any).transaction || (txResult as any).transactionId,
            };
            setLastResult(result);

            // Invalidate queries after a short delay to let the tx propagate
            setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['pendingAttacks'] });
                queryClient.invalidateQueries({ queryKey: ['attackHistory'] });
                queryClient.invalidateQueries({ queryKey: ['construct'] });
            }, 3000);

            return result;

        } catch (e) {
            const isCancelled = e instanceof DOMException && e.name === 'AbortError';
            if (isCancelled) {
                setLastResult(null);
                return { success: false, cancelled: true };
            }
            const errorMessage = e instanceof Error ? e.message : 'Attack failed';
            const result: AttackResult = {
                success: false,
                error: errorMessage,
            };
            setLastResult(result);
            return result;
        } finally {
            setAttacking(false);
        }
    }, [ledger, connectedAccount, Wallet, Ledger, queryClient, isMobile]);

    return { attack, attacking, lastResult, reset };
};
