import React, { useState, useMemo } from 'react';
import { ConstructData } from '@lib/construct/types';
import { getAttackTokenIds } from '@lib/construct/constants';
import { useConstructAttack } from '@hooks/useConstructAttack';
import { useTokenMeta } from '@hooks/useTokenMeta';
import { useTokenBalances } from '@hooks/useTokenBalances';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { TokenSelector, TokenSelection } from './TokenSelector';
import { CooldownTimer } from './CooldownTimer';
import styles from '@styles/Construct.module.scss';

interface AttackFormProps {
    construct: ConstructData;
    cooldownStatus?: {
        isInCooldown: boolean;
        blocksRemaining: number;
    };
}

export const AttackForm: React.FC<AttackFormProps> = ({ construct, cooldownStatus }) => {
    const [signaAmount, setSignaAmount] = useState('');
    const [tokenSelections, setTokenSelections] = useState<TokenSelection[]>([]);

    const connectedAccount = useAppSelector(selectConnectedAccount);
    const { attack, attacking, lastResult, reset } = useConstructAttack();

    // Get attack token IDs from environment
    const attackTokenIds = useMemo(() => getAttackTokenIds(), []);

    // Load token metadata
    const { tokens: tokenMetas, loading: tokensLoading } = useTokenMeta(attackTokenIds);

    // Load user's balances
    const { balances, signaBalance, loading: balancesLoading } = useTokenBalances(
        connectedAccount,
        attackTokenIds
    );

    const isInCooldown = cooldownStatus?.isInCooldown ?? false;

    const canAttack = useMemo(() => {
        if (!connectedAccount) return false;
        if (isInCooldown) return false;
        if (attacking) return false;
        if (!signaAmount || parseFloat(signaAmount) <= 0) return false;
        if (parseFloat(signaAmount) > signaBalance) return false;

        // Check token balances for selected tokens
        for (const selection of tokenSelections) {
            const qty = parseFloat(selection.quantity);
            if (qty > 0) {
                const balance = balances[selection.tokenId] ?? 0;
                if (qty > balance) return false;
            }
        }

        return true;
    }, [connectedAccount, isInCooldown, attacking, signaAmount, signaBalance, tokenSelections, balances]);

    const handleAttack = async () => {
        if (!canAttack) return;

        const tokens = tokenSelections
            .filter(s => parseFloat(s.quantity) > 0)
            .map(s => ({ tokenId: s.tokenId, quantity: s.quantity }));

        const result = await attack({
            contractId: construct.contractId,
            signaAmount,
            tokens,
        });

        if (result.success) {
            // Reset form on success
            setSignaAmount('');
            setTokenSelections([]);
        }
    };

    if (!connectedAccount) {
        return (
            <div className={styles.attackForm}>
                <div className={styles.connectPrompt}>
                    <p>Connect your wallet to attack this construct</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.attackForm}>
            <h3 className={styles.attackTitle}>Attack</h3>

            {/* Success/Error Messages */}
            {lastResult && (
                <div
                    style={{
                        padding: '0.75rem',
                        marginBottom: '1rem',
                        borderRadius: '8px',
                        background: lastResult.success
                            ? 'rgba(74, 222, 128, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                        color: lastResult.success ? '#4ade80' : '#ef4444',
                    }}
                >
                    {lastResult.success ? (
                        <span>Attack sent! TX: {lastResult.txId?.slice(0, 12)}...</span>
                    ) : (
                        <span>Error: {lastResult.error}</span>
                    )}
                    <button
                        onClick={reset}
                        style={{
                            marginLeft: '1rem',
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                        }}
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* Cooldown Warning */}
            {isInCooldown && cooldownStatus && (
                <CooldownTimer blocksRemaining={cooldownStatus.blocksRemaining} />
            )}

            {/* SIGNA Input */}
            <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>
                    SIGNA Amount (Balance: {signaBalance.toFixed(2)} SIGNA)
                </label>
                <input
                    type="number"
                    className={styles.signaInput}
                    placeholder="Enter SIGNA amount"
                    min="0"
                    step="0.01"
                    value={signaAmount}
                    onChange={e => setSignaAmount(e.target.value)}
                    disabled={attacking || isInCooldown}
                />
            </div>

            {/* Token Selector */}
            {!tokensLoading && !balancesLoading && (
                <TokenSelector
                    tokens={tokenMetas}
                    balances={balances}
                    selections={tokenSelections}
                    onChange={setTokenSelections}
                    disabled={attacking || isInCooldown}
                />
            )}

            {/* Attack Button */}
            <button
                className={styles.attackButton}
                onClick={handleAttack}
                disabled={!canAttack}
            >
                {attacking ? 'Attacking...' : isInCooldown ? 'In Cooldown' : 'Attack!'}
            </button>
        </div>
    );
};

export default AttackForm;
