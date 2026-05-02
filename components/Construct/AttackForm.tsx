import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ConstructData } from '@lib/construct/types';
import { getAttackTokenIds, getExplorerBaseUrl } from '@lib/construct/constants';
import { useConstructAttack } from '@hooks/useConstructAttack';
import { PlayerConstructStats } from '@hooks/usePlayerConstructStats';
import { useTokenMeta } from '@hooks/useTokenMeta';
import { useTokenBalances } from '@hooks/useTokenBalances';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { computeNarrationTags } from '@lib/narration/computeTags';
import { useIsMobile } from '@hooks/useIsMobile';
import { TokenSelector, TokenSelection } from './TokenSelector';
import { NarrationBanner } from './NarrationBanner';
import { CooldownTimer } from './CooldownTimer';
import { AttackEffect } from './AttackEffect';
import { Address } from '@signumjs/core';
import { Amount } from '@signumjs/util';

interface AttackFormProps {
    construct: ConstructData;
    cooldownStatus?: {
        isInCooldown: boolean;
        blocksRemaining: number;
    };
    playerStats?: PlayerConstructStats | null;
}

export const AttackForm: React.FC<AttackFormProps> = ({ construct, cooldownStatus, playerStats }) => {
    const [signaAmount, setSignaAmount] = useState('');
    const [tokenSelections, setTokenSelections] = useState<TokenSelection[]>([]);
    const [narration, setNarration] = useState<string | null>(null);
    const [narrationLoading, setNarrationLoading] = useState(false);

    const connectedAccount = useAppSelector(selectConnectedAccount);
    const { attack, attacking, lastResult, reset } = useConstructAttack();
    const [showEffect, setShowEffect] = useState(false);
    const isMobile = useIsMobile();
    const successRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (lastResult?.success) setShowEffect(true);
    }, [lastResult?.success]);

    useEffect(() => {
        if (!lastResult?.success || !isMobile) return;
        const t = setTimeout(() => {
            successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
        return () => clearTimeout(t);
    }, [lastResult?.success, isMobile]);

    const handleEffectDone = useCallback(() => setShowEffect(false), []);

    // Convert public key to account ID for balance lookups
    const accountId = useMemo(() => {
        if (!connectedAccount) return null;
        try {
            return Address.fromPublicKey(connectedAccount).getNumericId();
        } catch {
            return null;
        }
    }, [connectedAccount]);

    // Get attack token IDs from environment
    const attackTokenIds = useMemo(() => getAttackTokenIds(), []);

    // Load token metadata
    const { tokens: tokenMetas, loading: tokensLoading } = useTokenMeta(attackTokenIds);

    // Load user's balances
    const { balances, signaBalance, loading: balancesLoading } = useTokenBalances(
        accountId,
        attackTokenIds
    );

    const isInCooldown = cooldownStatus?.isInCooldown ?? false;

    // Activation amount in SIGNA (added on top of user's attack amount)
    const activationSigna = useMemo(() => {
        return parseFloat(Amount.fromPlanck(construct.minActivation).getSigna());
    }, [construct.minActivation]);

    const TX_FEE = 0.02;

    // Total SIGNA required = attack amount + activation + fee
    const totalRequired = useMemo(() => {
        const attack = parseFloat(signaAmount) || 0;
        return attack + activationSigna + TX_FEE;
    }, [signaAmount, activationSigna]);

    const MIN_SIGNA_ATTACK = 10;

    const canAttack = useMemo(() => {
        if (!connectedAccount) return false;
        if (isInCooldown) return false;
        if (attacking) return false;
        if (!signaAmount || parseFloat(signaAmount) < MIN_SIGNA_ATTACK) return false;
        if (totalRequired > signaBalance) return false;

        // Check token balances for selected tokens
        for (const selection of tokenSelections) {
            const qty = parseFloat(selection.quantity);
            if (qty > 0) {
                const balance = balances[selection.tokenId] ?? 0;
                if (qty > balance) return false;
            }
        }

        return true;
    }, [connectedAccount, isInCooldown, attacking, signaAmount, totalRequired, signaBalance, tokenSelections, balances]);

    const fetchNarration = async (tokens: { tokenId: string; quantity: string }[], attackSignaAmount: string) => {
        const seasonName = construct.seasonName;
        if (!seasonName) return;

        setNarrationLoading(true);
        try {
            const tags = computeNarrationTags({
                signaAmount: attackSignaAmount,
                tokens: tokens.map(t => ({ tokenId: t.tokenId, quantity: parseFloat(t.quantity) })),
                construct,
                playerStats: playerStats ?? null,
            });

            const res = await fetch('/api/narrations/pick', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seasonName,
                    constructName: construct.name,
                    locale: 'en',
                    tags,
                }),
            });

            if (res.status === 200) {
                const body = await res.json();
                setNarration(body.text);
            }
        } catch {
            // narration is non-critical; silently ignore
        } finally {
            setNarrationLoading(false);
        }
    };

    useEffect(() => {
        if (!lastResult?.success) return;
        const raw = localStorage.getItem('signarank_pending_attack');
        if (!raw) return;
        try {
            const { signaAmount: savedSigna, tokens: savedTokens } = JSON.parse(raw);
            localStorage.removeItem('signarank_pending_attack');
            fetchNarration(savedTokens, savedSigna);
        } catch {
            localStorage.removeItem('signarank_pending_attack');
        }
    }, [lastResult?.success]);

    const handleAttack = async () => {
        if (!canAttack) return;

        const tokens = tokenSelections
            .filter(s => parseFloat(s.quantity) > 0)
            .map(s => {
                const meta = tokenMetas.find(t => t.tokenId === s.tokenId);
                return { tokenId: s.tokenId, quantity: s.quantity, decimals: meta?.decimals ?? 0 };
            });

        localStorage.setItem('signarank_pending_attack', JSON.stringify({ signaAmount, tokens }));

        const result = await attack({
            contractId: construct.contractId,
            signaAmount,
            tokens,
        });

        if (result.success) {
            localStorage.removeItem('signarank_pending_attack');
            fetchNarration(tokens, signaAmount);
        }
    };

    if (!connectedAccount) {
        return (
            <div className="glass-static overflow-hidden">
                <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center gap-2.5">
                    <span className="text-[var(--ember)]">⚔</span>
                    <span
                        className="text-[0.7rem] text-[var(--text)] uppercase tracking-[0.15em]"
                        style={{ fontFamily: "'Cinzel', serif", fontWeight: 600 }}
                    >
                        Attack
                    </span>
                </div>
                <div className="p-8 text-center">
                    <p
                        className="text-[var(--text-dim)] text-[0.9rem] m-0"
                        style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                        Connect your wallet to attack this construct
                    </p>
                </div>
            </div>
        );
    }

    const header = (
        <div className="px-5 py-4 border-b border-[var(--glass-border)] flex items-center gap-2.5">
            <span className="text-[var(--ember)]">⚔</span>
            <span
                className="text-[0.7rem] text-[var(--text)] uppercase tracking-[0.15em]"
                style={{ fontFamily: "'Cinzel', serif", fontWeight: 600 }}
            >
                Attack
            </span>
        </div>
    );

    // Success view — replaces the form after a signed attack
    if (lastResult?.success) {
        const explorerHref = lastResult.txId
            ? `${getExplorerBaseUrl()}/tx/${lastResult.txId}`
            : null;

        const handleAttackAgain = () => {
            setNarration(null);
            reset();
        };

        return (
            <>
                {showEffect && <AttackEffect onDone={handleEffectDone} />}
                <div ref={successRef} className="glass-static overflow-hidden">
                {header}
                <div className="p-5 max-md:p-4">
                    <div
                        className="mb-4 py-3 px-4 rounded-sm flex items-center gap-3"
                        style={{
                            background: 'rgba(74, 222, 128, 0.06)',
                            border: '1px solid rgba(74,222,128,0.2)',
                        }}
                    >
                        <span style={{ color: '#4ade80', fontSize: '1.1rem' }}>✓</span>
                        <div className="flex-1 min-w-0">
                            <span
                                className="text-[0.8rem] block"
                                style={{ fontFamily: "'Cinzel', serif", color: '#4ade80' }}
                            >
                                Attack Launched
                            </span>
                            {explorerHref && (
                                <a
                                    href={explorerHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[0.7rem] underline truncate block mt-0.5"
                                    style={{
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        color: 'rgba(74,222,128,0.7)',
                                    }}
                                >
                                    View transaction ↗
                                </a>
                            )}
                        </div>
                    </div>

                    <NarrationBanner text={narration} loading={narrationLoading} />

                    <div
                        className="mt-4 py-2.5 px-3 rounded-sm text-center"
                        style={{
                            background: 'rgba(197,164,78,0.04)',
                            border: '1px solid rgba(197,164,78,0.12)',
                        }}
                    >
                        <p
                            className="text-[0.75rem] text-[var(--text-faint)] m-0 mb-3"
                            style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic' }}
                        >
                            You must wait {construct.coolDownInBlocks} block{construct.coolDownInBlocks !== 1 ? 's' : ''} before attacking again.
                        </p>
                        <button
                            onClick={handleAttackAgain}
                            className="py-2 px-5 border rounded-sm text-[0.75rem] uppercase tracking-[0.1em] cursor-pointer transition-all duration-200 hover:bg-[rgba(197,164,78,0.08)]"
                            style={{
                                fontFamily: "'Cinzel', serif",
                                color: 'var(--gold)',
                                borderColor: 'rgba(197,164,78,0.3)',
                                background: 'transparent',
                            }}
                        >
                            Attack Again
                        </button>
                    </div>
                </div>
                </div>
            </>
        );
    }

    return (
        <div className="glass-static overflow-hidden">
            {header}

            <div className="p-5 max-md:p-4">
                {/* Error message */}
                {lastResult && !lastResult.success && (
                    <div
                        className="flex items-center justify-between mb-4 py-2.5 px-3 rounded-sm"
                        style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                        }}
                    >
                        <span
                            className="text-[0.8rem]"
                            style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#ef4444' }}
                        >
                            Error: {lastResult.error}
                        </span>
                        <button
                            onClick={reset}
                            className="bg-transparent border-none cursor-pointer text-[0.75rem] underline"
                            style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#ef4444' }}
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
                <div className="mb-4">
                    <label
                        className="block text-[var(--text-faint)] text-[0.65rem] uppercase tracking-[0.1em] mb-2"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                        SIGNA Amount
                        <span className="text-[var(--text-dim)] ml-2 normal-case tracking-normal">
                            (Balance: {signaBalance.toFixed(2)})
                        </span>
                    </label>
                    <input
                        type="number"
                        className="w-full py-2.5 px-3 bg-[rgba(8,6,12,0.4)] border border-[var(--glass-border)] rounded-sm text-[var(--text)] text-[0.85rem] max-md:py-2 max-md:px-2.5 max-md:text-[0.8rem] focus:outline-none focus:border-[var(--gold)] placeholder:text-[var(--text-faint)]"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        value={signaAmount}
                        onChange={e => setSignaAmount(e.target.value)}
                        disabled={attacking || isInCooldown}
                    />
                    {signaAmount && parseFloat(signaAmount) > 0 && parseFloat(signaAmount) < MIN_SIGNA_ATTACK && (
                        <div
                            className="mt-1.5 text-[0.6rem]"
                            style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--ember)' }}
                        >
                            Minimum attack is {MIN_SIGNA_ATTACK} SIGNA — 1 HP per 10 SIGNA (per the rules)
                        </div>
                    )}
                    {signaAmount && parseFloat(signaAmount) >= MIN_SIGNA_ATTACK && (
                        <div
                            className="mt-1.5 text-[0.6rem] text-[var(--text-faint)]"
                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                            Total: {totalRequired.toFixed(2)} SIGNA (attack + {activationSigna} activation + {TX_FEE} fee)
                        </div>
                    )}
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
                    className="w-full py-3 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer transition-all duration-200 max-md:py-2.5 max-md:text-[0.8rem] hover:enabled:brightness-110 hover:enabled:shadow-[0_4px_20px_rgba(232,93,58,0.3)] disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                        fontFamily: "'Cinzel', serif",
                        background: 'linear-gradient(135deg, var(--ember), #c44a2a)',
                    }}
                    onClick={handleAttack}
                    disabled={!canAttack}
                >
                    {attacking ? 'Attacking...' : isInCooldown ? 'In Cooldown' : 'Attack'}
                </button>
            </div>
        </div>
    );
};

export default AttackForm;
