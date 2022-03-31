import {Button} from '@components/Button';
import {requestWalletConnection} from '../../lib/requestWalletConnection';
import styles from './connectButton.module.scss';
import {AddressInput} from '@components/AddressInput';
import {useMemo, useState} from 'react';
import {useAppSelector} from '@states/hooks';
import {selectConnectedAccount} from '@states/appState';
import {useAddressPrefix} from '@hooks/useAddressPrefix';
import {Address} from '@signumjs/core';

interface Props {
    withAddressInput?: boolean
}

export const ConnectButton: React.FC<Props> = ({withAddressInput = false}) => {
    const [address, setAddress] = useState('')
    const connectedAccount = useAppSelector(selectConnectedAccount)
    const prefix = useAddressPrefix()

    const onAddressChange = (e: any) => {
        setAddress(e.target.value)
        // TODO: resolve and check address
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
                            <AddressInput value={address} onChange={onAddressChange}/>
                        </div>
                    )
                }
            </div>
        )
}
