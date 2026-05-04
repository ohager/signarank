import {Button} from '@components/Button';
import {requestWalletConnection, requestWalletDisconnection, requestMobileWalletConnection} from '@lib/requestWalletConnection';
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
import Link from 'next/link';

const isTestnet = process.env.NEXT_PUBLIC_SIGNUM_NETWORK === "Signum-TESTNET"

interface Props {
    /** "inline" = compact for header, "full" = hero connect box with address input */
    mode?: 'inline' | 'full'
    withAddressInput?: boolean
}

export const ConnectButton: React.FC<Props> = ({mode = 'inline', withAddressInput = false}) => {
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
            const accountId = Address.create(address).getNumericId()
            const {publicKey} = await ledger.account.getAccount({ accountId })
            return publicKey;
        }catch(e){
            // ignore
        }
        setError('Invalid or unknown account')
    }, [ledger, address])

    const onAddressEnter = async () => {
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

    const handleDisconnect = () => {
        requestWalletDisconnection()
    }

    // ── INLINE MODE (header) ──
    if (mode === 'inline') {
        if (connectedAddress) {
            return (
                <div className="flex items-center gap-2">
                    {isTestnet && (
                        <span className="text-[0.45rem] tracking-[0.06em] text-red-400 px-1.5 py-[1px] border border-red-400/30 rounded-sm leading-tight" style={{fontFamily: "'IBM Plex Mono', monospace"}}>TESTNET</span>
                    )}
                    <Link
                        href={`/address/${accountId}`}
                        className="text-[0.7rem] text-[var(--gold)] hover:text-[var(--gold-bright)] transition-colors truncate max-w-[180px]"
                        style={{fontFamily: "'IBM Plex Mono', monospace"}}
                        title={connectedAddress}
                    >
                        {connectedAddress}
                    </Link>
                    <button
                        onClick={handleDisconnect}
                        className="text-[0.6rem] text-[var(--text-faint)] hover:text-[var(--ember)] transition-colors tracking-[0.08em] uppercase px-2 py-1 border border-[var(--glass-border)] hover:border-[var(--ember)] rounded-sm"
                        style={{fontFamily: "'IBM Plex Mono', monospace"}}
                        title="Disconnect wallet"
                    >
                        ✕
                    </button>
                </div>
            )
        }

        return (
            <div className="flex flex-col items-end gap-1">
                <button
                    onClick={handleConnect}
                    className="px-6 py-2.5 bg-transparent text-[var(--gold)] border border-[var(--gold-dim)] rounded-sm text-[0.7rem] font-semibold tracking-[0.12em] uppercase transition-all duration-300 hover:bg-[var(--gold)] hover:text-[#080610] hover:shadow-[0_0_30px_rgba(197,164,78,0.25)] flex items-center gap-2"
                    style={{fontFamily: "'Cinzel', serif"}}
                >
                    Connect Wallet
                    {isTestnet && (
                        <span className="text-[0.45rem] tracking-[0.06em] text-red-400 px-1.5 py-[1px] border border-red-400/30 rounded-sm leading-tight" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                            TESTNET
                        </span>
                    )}
                </button>
                {walletError && <div className="text-[var(--ember)] text-[0.6rem]" style={{fontFamily: "'IBM Plex Mono', monospace"}}>{walletError}</div>}
            </div>
        )
    }

    // ── FULL MODE (hero connect box) ──
    if (connectedAddress) {
        return (
            <div className="text-center">
                <div className="text-[0.75rem] text-[var(--text-dim)] mb-1" style={{fontFamily: "'Cormorant Garamond', serif"}}>Connected as</div>
                <div className="flex items-center justify-center gap-2 mb-3">
                    {isTestnet && (
                        <span className="text-[0.45rem] tracking-[0.06em] text-red-400 px-1.5 py-[1px] border border-red-400/30 rounded-sm leading-tight" style={{fontFamily: "'IBM Plex Mono', monospace"}}>TESTNET</span>
                    )}
                    <Link
                        href={`/address/${accountId}`}
                        className="text-sm font-semibold text-[var(--gold)] hover:text-[var(--gold-bright)] transition-colors"
                        style={{fontFamily: "'IBM Plex Mono', monospace"}}
                    >
                        {connectedAddress}
                    </Link>
                </div>
                <div className="flex items-center justify-center gap-3">
                    <Link
                        href={`/address/${accountId}`}
                        className="px-6 py-2.5 bg-transparent text-[var(--gold)] border border-[var(--gold-dim)] rounded-sm text-[0.7rem] font-semibold tracking-[0.12em] uppercase transition-all duration-300 hover:bg-[var(--gold)] hover:text-[#080610] hover:shadow-[0_0_30px_rgba(197,164,78,0.25)]"
                        style={{fontFamily: "'Cinzel', serif"}}
                    >
                        Check your Rank
                    </Link>
                    <button
                        onClick={handleDisconnect}
                        className="px-4 py-2.5 text-[0.65rem] text-[var(--text-faint)] hover:text-[var(--ember)] border border-[var(--glass-border)] hover:border-[var(--ember)] rounded-sm transition-all duration-200 tracking-[0.1em] uppercase"
                        style={{fontFamily: "'IBM Plex Mono', monospace"}}
                    >
                        Disconnect
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center gap-1">
            <button
                onClick={handleConnect}
                className="px-6 py-2.5 bg-transparent text-[var(--gold)] border border-[var(--gold-dim)] rounded-sm text-[0.7rem] font-semibold tracking-[0.12em] uppercase transition-all duration-300 hover:bg-[var(--gold)] hover:text-[#080610] hover:shadow-[0_0_30px_rgba(197,164,78,0.25)] flex items-center gap-2"
                style={{fontFamily: "'Cinzel', serif"}}
            >
                Connect Wallet
                {isTestnet && (
                    <span className="text-[0.45rem] tracking-[0.06em] text-red-400 px-1.5 py-[1px] border border-red-400/30 rounded-sm leading-tight" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                        TESTNET
                    </span>
                )}
            </button>
            {walletError && <div className="text-[var(--ember)] text-[0.65rem] text-center mt-1" style={{fontFamily: "'IBM Plex Mono', monospace"}}>{walletError}</div>}
            {withAddressInput && (
                <div className="w-full mt-4">
                    <div className="flex items-center gap-4 my-3 text-[var(--text-faint)] text-[0.65rem] tracking-[0.1em] uppercase" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
                        <span className="flex-1 h-px bg-[var(--glass-border)]"/><span>or lookup</span><span className="flex-1 h-px bg-[var(--glass-border)]"/>
                    </div>
                    <AddressInput value={address} onChange={onAddressChange} onEnter={onAddressEnter}/>
                    {error && <div className="text-[var(--ember)] text-xs mt-1" style={{fontFamily: "'IBM Plex Mono', monospace"}}>{error}</div>}
                </div>
            )}
        </div>
    )
}
