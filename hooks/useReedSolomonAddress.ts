import {useMemo} from 'react';
import {Address} from '@signumjs/core';
import {useAddressPrefix} from '@hooks/useAddressPrefix';

export const useReedSolomonAddress = (address: string): string => {
    const prefix = useAddressPrefix()
    return useMemo(() => {
        try{
            return Address.create(address, prefix).getReedSolomonAddress()
        } catch(e){
            console.error('Invalid address', address)
            return ""
        }

    }, [address])
};
