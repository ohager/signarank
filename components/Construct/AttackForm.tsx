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
            <div className="bg-black/60 rounded-2xl p-4 border border-white/10 backdrop-blur-sm max-md:p-3">
                <div className="text-center p-8 bg-white/5 rounded-lg text-white/70">
                    <p>Connect your wallet to attack this construct</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-black/60 rounded-2xl p-4 border border-white/10 backdrop-blur-sm max-md:p-3">
            <h3 className="text-base font-bold text-white m-0 mb-3 max-md:text-[0.95rem]">Attack</h3>

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
            <div className="mb-3">
                <label className="block text-white/70 text-[0.8rem] mb-1.5 max-md:text-xs">
                    SIGNA Amount (Balance: {signaBalance.toFixed(2)} SIGNA)
                </label>
                <input
                    type="number"
                    className="w-full py-2.5 px-3 bg-white/10 border border-white/20 rounded-lg text-white text-[0.9rem] max-md:py-2 max-md:px-2.5 max-md:text-[0.85rem] focus:outline-none focus:border-[#D9048E] placeholder:text-white/40"
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
                className="w-full py-3 bg-gradient-to-br from-[#D9048E] to-[#ff4ecd] border-none rounded-lg text-white text-[0.95rem] font-bold cursor-pointer transition-all duration-200 max-md:py-2.5 max-md:text-[0.9rem] hover:enabled:-translate-y-0.5 hover:enabled:shadow-[0_4px_20px_rgba(217,4,142,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleAttack}
                disabled={!canAttack}
            >
                {attacking ? 'Attacking...' : isInCooldown ? 'In Cooldown' : 'Attack!'}
            </button>
        </div>
    );
};

export default AttackForm;
