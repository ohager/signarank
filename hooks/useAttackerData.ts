import {useQuery} from 'react-query';
import {useSignumLedger} from './useSignumLedger';
import {getSignaRankTokenId} from "@lib/construct/constants";
import {Address} from "@signumjs/core";

export const useAttackerData = (accountId: string | null | undefined) => {
    const ledger = useSignumLedger();

    const {data} = useQuery(
        ['accountName', accountId],
        async () => {
            if (!ledger || !accountId) return null;
            try {
                const account = await ledger.account.getAccount({accountId});
                const xpTokenId = getSignaRankTokenId()
                const xp = account.assetBalances.find( ab => ab.asset === xpTokenId )
                return {
                    attacker: account.accountRS,
                    attackerName: account.name,
                    attackerXp: xp?.balanceQNT || 0
                };
            } catch {
                return {
                    attacker: Address.create(accountId).getReedSolomonAddress(),
                    attackerName: '',
                    attackerXp: 0
                };
            }
        },
        {
            enabled: !!ledger && !!accountId,
            staleTime: Infinity,
            cacheTime: Infinity,
            refetchOnWindowFocus: false,
        }
    );

    return data ?? null;
};
