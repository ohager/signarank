import React from 'react';
import { TokenMeta } from '@lib/construct/types';
import { getSignumSwapUrl } from '@lib/construct/constants';

export interface TokenSelection {
    tokenId: string;
    quantity: string;
}

interface TokenSelectorProps {
    tokens: TokenMeta[];
    balances: Record<string, number>;
    selections: TokenSelection[];
    onChange: (selections: TokenSelection[]) => void;
    disabled?: boolean;
}

export const TokenSelector: React.FC<TokenSelectorProps> = ({
    tokens,
    balances,
    selections,
    onChange,
    disabled = false,
}) => {
    const handleQuantityChange = (tokenId: string, quantity: string) => {
        const existing = selections.find(s => s.tokenId === tokenId);
        if (existing) {
            onChange(
                selections.map(s =>
                    s.tokenId === tokenId ? { ...s, quantity } : s
                )
            );
        } else {
            onChange([...selections, { tokenId, quantity }]);
        }
    };

    const getQuantity = (tokenId: string): string => {
        return selections.find(s => s.tokenId === tokenId)?.quantity || '';
    };

    if (tokens.length === 0) {
        return (
            <div className="mb-4">
                <p
                    className="text-[var(--text-faint)] text-[0.65rem] uppercase tracking-[0.1em] mb-2"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                    Attack Tokens (optional)
                </p>
                <p
                    className="text-[var(--text-faint)] text-[0.85rem] m-0"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                >
                    No attack tokens configured
                </p>
            </div>
        );
    }

    return (
        <div className="mb-4">
            <p
                className="text-[var(--text-faint)] text-[0.65rem] uppercase tracking-[0.1em] mb-2"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
                Attack Tokens (optional)
            </p>
            <div className="flex flex-col gap-2">
                {tokens.map(token => {
                    const balance = balances[token.tokenId] ?? 0;
                    const formattedBalance = formatBalance(balance, token.decimals);

                    return (
                        <div
                            key={token.tokenId}
                            className="flex items-center gap-3 py-2.5 px-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-sm max-md:py-2 max-md:px-2.5 max-md:gap-2"
                        >
                            {token.iconUrl ? (
                                <img
                                    src={token.iconUrl}
                                    alt={token.name}
                                    className="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.06)] max-md:w-6 max-md:h-6"
                                />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-[rgba(255,255,255,0.06)] flex items-center justify-center max-md:w-6 max-md:h-6">
                                    <span
                                        className="text-[var(--text-faint)] text-[0.75rem]"
                                        style={{ fontFamily: "'Cinzel', serif" }}
                                    >
                                        {token.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div
                                    className="text-[var(--text)] text-[0.8rem] max-md:text-[0.75rem]"
                                    style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}
                                >
                                    {token.name}
                                </div>
                                <div
                                    className="flex items-center gap-2"
                                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                >
                                    <span className="text-[var(--text-faint)] text-[0.65rem]">
                                        Balance: {formattedBalance}
                                    </span>
                                    <a
                                        href={`${getSignumSwapUrl()}/tokens/${token.tokenId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[0.6rem] uppercase tracking-[0.06em] transition-colors hover:text-[var(--gold)]"
                                        style={{ color: 'rgba(197,164,78,0.6)' }}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        Buy ↗
                                    </a>
                                </div>
                            </div>
                            <input
                                type="number"
                                className="w-[90px] py-1.5 px-2 bg-[rgba(8,6,12,0.4)] border border-[var(--glass-border)] rounded-sm text-[var(--text)] text-right text-[0.8rem] max-md:w-20 max-md:py-1 max-md:px-1.5 max-md:text-[0.75rem] focus:outline-none focus:border-[var(--gold)]"
                                style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                                placeholder="0"
                                min="0"
                                max={balance}
                                step={1 / Math.pow(10, token.decimals)}
                                value={getQuantity(token.tokenId)}
                                onChange={e => handleQuantityChange(token.tokenId, e.target.value)}
                                disabled={disabled || balance === 0}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

function formatBalance(balance: number, decimals: number): string {
    if (decimals === 0) {
        return balance.toLocaleString();
    }
    const value = balance / Math.pow(10, decimals);
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    });
}

export default TokenSelector;
