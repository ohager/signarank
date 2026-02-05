import React from 'react';
import { TokenMeta } from '@lib/construct/types';
import styles from '@styles/Construct.module.scss';

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
            <div className={styles.tokenSection}>
                <p className={styles.tokenTitle}>Attack Tokens (optional)</p>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
                    No attack tokens configured
                </p>
            </div>
        );
    }

    return (
        <div className={styles.tokenSection}>
            <p className={styles.tokenTitle}>Attack Tokens (optional)</p>
            <div className={styles.tokenList}>
                {tokens.map(token => {
                    const balance = balances[token.tokenId] ?? 0;
                    const formattedBalance = formatBalance(balance, token.decimals);

                    return (
                        <div key={token.tokenId} className={styles.tokenItem}>
                            {token.iconUrl ? (
                                <img
                                    src={token.iconUrl}
                                    alt={token.name}
                                    className={styles.tokenIcon}
                                />
                            ) : (
                                <div className={styles.tokenIcon}>
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
                            <div className={styles.tokenInfo}>
                                <div className={styles.tokenName}>{token.name}</div>
                                <div className={styles.tokenBalance}>
                                    Balance: {formattedBalance}
                                </div>
                            </div>
                            <input
                                type="number"
                                className={styles.tokenInput}
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
