import React from 'react';
import { TokenMeta } from '@lib/construct/types';

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
            <div className="my-4">
                <p className="text-white/70 text-[0.8rem] mb-2 max-md:text-xs">Attack Tokens (optional)</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                    No attack tokens configured
                </p>
            </div>
        );
    }

    return (
        <div className="my-4">
            <p className="text-white/70 text-[0.8rem] mb-2 max-md:text-xs">Attack Tokens (optional)</p>
            <div className="flex flex-col gap-2">
                {tokens.map(token => {
                    const balance = balances[token.tokenId] ?? 0;
                    const formattedBalance = formatBalance(balance, token.decimals);

                    return (
                        <div key={token.tokenId} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg max-md:p-1.5 max-md:gap-1.5">
                            {token.iconUrl ? (
                                <img
                                    src={token.iconUrl}
                                    alt={token.name}
                                    className="w-7 h-7 rounded-full bg-white/10 max-md:w-6 max-md:h-6"
                                />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-white/10 max-md:w-6 max-md:h-6">
                                    <span style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        height: '100%',
                                        color: 'rgba(255,255,255,0.5)',
                                        fontSize: '0.8rem'
                                    }}>
                                        {token.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <div className="flex-1">
                                <div className="text-white font-medium text-[0.85rem] max-md:text-[0.8rem]">{token.name}</div>
                                <div className="text-white/50 text-[0.7rem]">
                                    Balance: {formattedBalance}
                                </div>
                            </div>
                            <input
                                type="number"
                                className="w-[90px] py-1.5 px-2 bg-white/10 border border-white/20 rounded-md text-white text-right text-[0.85rem] max-md:w-20 max-md:py-1 max-md:px-1.5 max-md:text-[0.8rem] focus:outline-none focus:border-[#D9048E]"
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
