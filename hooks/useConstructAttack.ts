import { useState, useCallback } from 'react';
import { Amount } from '@signumjs/util';
import { Player, Signer } from '@signarank/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAppContext } from '@hooks/useAppContext';
import { useSignumLedger } from '@hooks/useSignumLedger';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
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

    const { Wallet } = useAppContext();
    const ledger = useSignumLedger();
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const queryClient = useQueryClient();

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

            const signer: Signer = {
                getPublicKey: async () => connectedAccount,
                sign: async (unsignedTransactionBytes: string) => {
                    const confirmed = await Wallet.Extension.confirm(unsignedTransactionBytes);
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

            const txResult = await player.attackConstruct({
                targetConstruct: contractId,
                force: Amount.fromSigna(signaAmount),
                powerUps: [],
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
    }, [ledger, connectedAccount, Wallet, queryClient]);

    return { attack, attacking, lastResult, reset };
};
