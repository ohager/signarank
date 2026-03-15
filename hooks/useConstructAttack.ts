import { useState, useCallback } from 'react';
import { Amount } from '@signumjs/util';
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
            const { contractId, signaAmount, tokens = [] } = params;

            // Convert SIGNA to Planck
            const amountPlanck = Amount.fromSigna(signaAmount).getPlanck();
            const feePlanck = Amount.fromSigna('0.02').getPlanck(); // 0.02 SIGNA fee

            // Build unsigned transaction
            // For simple SIGNA transfer to contract
            const unsignedTx = await ledger.transaction.sendAmountToSingleRecipient({
                recipientId: contractId,
                amountPlanck,
                feePlanck,
                senderPublicKey: connectedAccount,
            });

            // TODO: Handle token attachments when sending with assets
            // This requires using the multi-asset transfer or contract call with assets
            // For now, we only support SIGNA-only attacks
            if (tokens.length > 0) {
                console.warn('Token attachments not yet implemented - sending SIGNA only');
            }

            // Use wallet extension to sign and broadcast
            const signedTx = await Wallet.Extension.confirm(
                unsignedTx.unsignedTransactionBytes
            );

            const result: AttackResult = {
                success: true,
                txId: signedTx.transactionId,
            };
            setLastResult(result);
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
    }, [ledger, connectedAccount, Wallet]);

    return { attack, attacking, lastResult, reset };
};
