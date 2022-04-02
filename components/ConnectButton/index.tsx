import {Button} from '@components/Button';
import {requestWalletConnection} from '@lib/requestWalletConnection';
import styles from './connectButton.module.scss';
import {AddressInput} from '@components/AddressInput';
import {useCallback, useMemo, useState} from 'react';
import {useAppDispatch, useAppSelector} from '@states/hooks';
import {selectConnectedAccount, actions} from '@states/appState';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {Address} from '@signumjs/core';
import {useSignumLedger} from '@hooks/useSignumLedger';

interface Props {
    withAddressInput?: boolean
}

export const ConnectButton: React.FC<Props> = ({withAddressInput = false}) => {
    const [address, setAddress] = useState('')
    const [isFetching, setIsFetching] = useState(false)
    const [error, setError] = useState('error')
    const connectedAccount = useAppSelector(selectConnectedAccount)
    const ledger  = useSignumLedger()
    const dispatch = useAppDispatch()
    const prefix = useAddressPrefix()

    const onAddressChange = (e: any) => {
        setError('')
        setAddress(e.target.value)
    }

    const fetchAccountsPublicKey = useCallback(async () => {

        let publicKey = null;
        try{
            const  accountId = Address.create(address).getNumericId()
            // TOOD: fetch by alias
            // @ts-ignore
            const { publicKey : pk} = await ledger?.account.getAccount({
                accountId
            })

            if(pk && !pk.startsWith('000000000000000')){
                publicKey = pk
            }
        }catch(e){
            // ignore
        }

        if(!publicKey){
            setError('Invalid or unknown account')
        }
        return  publicKey
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

    return connectedAddress
        ? (
            <div className={styles.accountWrapper}>
                <div>You are connected with</div>
                <div className={styles.address}>{connectedAddress}</div>
            </div>
        )

        : (
            <div className={styles.connectButtonWrapper}>
                <Button onClick={requestWalletConnection} label="Connect Wallet"/>
                {
                    withAddressInput && (
                        <div>
                            <div className={styles.or}>OR</div>
                            <AddressInput value={address} onChange={onAddressChange} onEnter={onAddressEnter}/>
                            {error && <div className={styles.error}>{error}</div> }
                        </div>
                    )
                }
            </div>
        )
}
