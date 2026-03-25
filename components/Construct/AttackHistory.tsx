import React, {useCallback, useMemo} from 'react';
import {useAttackHistory} from '@hooks/useAttackHistory';
import {Address} from "@signumjs/core";
import {ChainTime} from "@signumjs/util";
import {getExplorerBaseUrl} from '@lib/explorerUrl';

interface AttackHistoryProps {
    contractId: string;
    xpTokenId: string;
}

export const AttackHistory: React.FC<AttackHistoryProps> = ({contractId, xpTokenId}) => {
    const {attacks, loading, error} = useAttackHistory(contractId, xpTokenId);

    const formatTimeAgo = (txTimestamp: number): string => {
        const timestamp = ChainTime.fromChainTimestamp(txTimestamp).getEpoch();
        const seconds = Math.floor(Date.now()  - timestamp) / 1000;
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    return (
        <div className="bg-black/60 rounded-2xl p-4 border border-white/10 backdrop-blur-sm max-md:p-3">
            <h3 className="text-base font-bold text-white m-0 mb-3 max-md:text-[0.95rem]">Recent Attacks</h3>

            {loading && (
                <div className="text-white/50 text-center p-8">Loading attack history...</div>
            )}

            {error && (
                <div className="text-white/50 text-center p-8" style={{color: '#ef4444'}}>
                    Error: {error}
                </div>
            )}

            {!loading && !error && attacks.length === 0 && (
                <div className="text-white/50 text-center p-8">No attacks yet. Be the first!</div>
            )}

            {!loading && !error && attacks.length > 0 && (
                <div className="flex flex-col gap-2">
                    {attacks.map((attack, index) => (
                        <div key={attack.txId || index} className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg max-md:py-1.5 max-md:px-2.5 max-md:flex-col max-md:items-start max-md:gap-1">
                            <div className="flex flex-col">
                                <span className="text-white font-mono text-[0.8rem] max-md:text-xs">
                                    {attack.attackerName ? `[${attack.attackerName}] ` : ''}
                                    {attack.attacker} ({attack.attackerXp} XP)
                                </span>
                                <span className="flex items-center gap-2">
                                    <span className="text-white/50 text-[0.7rem]">
                                        {formatTimeAgo(attack.timestamp)}
                                    </span>
                                    {attack.blockHeight > 0 && (
                                        <span className="text-white/40 text-[0.65rem] font-mono">
                                            Block {attack.blockHeight.toLocaleString()}
                                        </span>
                                    )}
                                    {attack.txId && (
                                        <a
                                            className="text-[rgba(100,180,255,0.7)] text-[0.65rem] no-underline hover:text-[rgba(100,180,255,1)] hover:underline"
                                            href={`${getExplorerBaseUrl()}/tx/${attack.txId}`}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                            title="View in Explorer"
                                        >
                                            Tx
                                        </a>
                                    )}
                                </span>
                            </div>
                            <span className="text-red-500 font-bold text-[0.9rem] max-md:text-[0.85rem]">
                                -{attack.damage.toLocaleString()} HP
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AttackHistory;
