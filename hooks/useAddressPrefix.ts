import {AppContext, AppContextType} from '@components/contexts/AppContext';
import {useContext} from 'react';
import {AddressPrefix} from '@signumjs/core';

export const useAddressPrefix = (): string => {
    const {Ledger} = useContext(AppContext);
    return Ledger.Network.indexOf('TESTNET') !== -1 ? AddressPrefix.TestNet : AddressPrefix.MainNet
};
