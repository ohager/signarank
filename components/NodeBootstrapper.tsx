import {useEffect} from 'react';
import {LedgerClientFactory} from '@signumjs/core';
import {useAppContext} from '@hooks/useAppContext';
import {useAppDispatch} from '@states/hooks';
import {appSlice} from '@states/appState'

export const NodeBootstrapper = () => {
    const {Ledger} = useAppContext()
    const dispatch = useAppDispatch()
    useEffect(() => {

        if (!Ledger.DefaultNode || !Ledger.ReliableNodes) return;

        dispatch(appSlice.actions.setNodeHost(Ledger.DefaultNode))
        const client = LedgerClientFactory.createClient({
            nodeHost: Ledger.DefaultNode,
            reliableNodeHosts: Ledger.ReliableNodes
        })

        if (Ledger.ReliableNodes.length > 0) {
            client.service.selectBestHost(false).then(host => {
                console.debug('Selected host:', host)
                dispatch(appSlice.actions.setNodeHost(host))
            })
        }

    }, [Ledger.DefaultNode, Ledger.ReliableNodes])

    return null;
}
