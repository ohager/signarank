import {Button} from '@components/Button';
import {requestWalletConnection, requestMobileWalletConnection} from '@lib/requestWalletConnection';
import {AddressInput} from '@components/AddressInput';
import {useCallback, useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '@states/hooks';
import {selectConnectedAccount, actions, selectWalletError} from '@states/appState';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {useIsMobile} from '@hooks/useIsMobile';
import {useAppContext} from '@hooks/useAppContext';
import {Address} from '@signumjs/core';
import {useSignumLedger} from '@hooks/useSignumLedger';
import {useRouter} from 'next/router';

interface Props {
    withAddressInput?: boolean
}

export const ConnectButton: React.FC<Props> = ({withAddressInput = false}) => {
    const [address, setAddress] = useState('')
    const [isFetching, setIsFetching] = useState(false)
    const [error, setError] = useState('')
    const connectedAccount = useAppSelector(selectConnectedAccount)
    const walletError = useAppSelector(selectWalletError)
    const ledger  = useSignumLedger()
    const dispatch = useAppDispatch()
    const prefix = useAddressPrefix()
    const isMobile = useIsMobile()
    const {Wallet, Ledger} = useAppContext()
    const router = useRouter()

    const onAddressChange = (e: any) => {
        setError('')
        setAddress(e.target.value)
    }

    const fetchAccountsPublicKey = useCallback(async () => {

        if(!ledger) return;

        try{
            const  accountId = Address.create(address).getNumericId()
            const {publicKey} = await ledger.account.getAccount({
                accountId
            })
            return publicKey;
        }catch(e){
            // ignore
        }

        setError('Invalid or unknown account')
    }, [ledger, address])

    const onAddressEnter = async (e: any) => {
        if(!ledger || isFetching) return;

        setIsFetching(true);
        const publicKey = await fetchAccountsPublicKey()
        if(publicKey){
            dispatch(actions.setConnectedAccount(publicKey))
        }
        setIsFetching(false);
    }

    const connectedAddress = useMemo(() => {
        if (!connectedAccount) return null;
        return Address.fromPublicKey(connectedAccount, prefix).getReedSolomonAddress()
    }, [connectedAccount])

    const accountId = useMemo(() => {
        if (!connectedAccount) return null;
        return Address.fromPublicKey(connectedAccount).getNumericId()
    }, [connectedAccount])

    const handleConnect = () => {
        if (isMobile) {
            requestMobileWalletConnection(Wallet.Mobile, Ledger.Network, router.asPath);
        } else {
            requestWalletConnection();
        }
    }

    const handleCheckRank = () => {
        if (accountId) {
            router.push(`/address/${accountId}`)
        }
    }

    return connectedAddress
        ? (
            <div className="text-sm">
                <div>You are connected with</div>
                <div className="text-lg font-bold">{connectedAddress}</div>
                <Button onClick={handleCheckRank} label="Check your Rank"/>
            </div>
        )

        : (
            <div className="flex flex-col justify-center p-1">
                <Button onClick={handleConnect} label="Connect Wallet"/>
                {walletError && <div className="relative text-[var(--red)] text-[10px] text-center mt-1">{walletError}</div> }
                {
                    withAddressInput && (
                        <div>
                            <div className="m-2">OR</div>
                            <AddressInput value={address} onChange={onAddressChange} onEnter={onAddressEnter}/>
                            {error && <div className="absolute text-[var(--red)] text-sm text-left mt-1">{error}</div> }
                        </div>
                    )
                }
            </div>
        )
}
