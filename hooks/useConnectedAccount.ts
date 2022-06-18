import {useMemo} from 'react';
import {Address} from '@signumjs/core';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {useAppSelector} from '@states/hooks';
import {selectConnectedAccount} from '@states/appState';

export const useConnectedAccount = ():  Address | null => {
    const connectedPublicKey = useAppSelector(selectConnectedAccount)
    const prefix = useAddressPrefix()
    return useMemo(() => {
        if(!connectedPublicKey) return null;
        try{
            return Address.fromPublicKey(connectedPublicKey, prefix)
        } catch(e){
            console.error('Invalid address', connectedPublicKey)
            return null
        }

    }, [prefix, connectedPublicKey])
};
