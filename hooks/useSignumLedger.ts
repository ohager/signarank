import {useEffect, useState} from 'react';
import {Ledger, LedgerClientFactory} from '@signumjs/core';
import {useAppSelector} from '@states/hooks';
import {selectNodeHost} from '@states/appState';

export const useSignumLedger = (): Ledger | null => {
    const [ledger, setLedger] = useState<Ledger | null>(null)
    const nodeHost = useAppSelector(selectNodeHost)
    useEffect(() => {
        if (!nodeHost) return;
        const ledgerClient = LedgerClientFactory.createClient({
            nodeHost
        })
        setLedger(ledgerClient)
    }, [nodeHost])

    return ledger;
};
