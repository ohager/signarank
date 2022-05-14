import { useAppDispatch} from "@states/hooks";
import { actions as appActions } from "@states/appState";
import { useEffect, useRef } from "react";
import {
    GenericExtensionWallet, InvalidNetworkError,
    WalletConnection,
} from "@signumjs/wallets";
import {useAppContext} from '@hooks/useAppContext';

export const WalletHandler = () => {
    const listenerRef = useRef<any>(null);
    const connectionRef = useRef<WalletConnection | null>(null);
    const dispatch = useAppDispatch();
    const { Ledger, Wallet } = useAppContext();

    useEffect(() => {
        function handleDisconnectWallet() {
            listenerRef.current?.unlisten();
            dispatch(appActions.setConnectedAccount(null));
            Wallet.Extension = new GenericExtensionWallet();
        }

        function onNetworkChange(args: any) {
            if (args.networkName !== Ledger.Network) {
                dispatch(appActions.setWalletError(`Wrong Network detected. Expected: ${Ledger.Network}`));
            }
        }

        function onAccountChange(args: any) {
            dispatch(appActions.setConnectedAccount(args.accountPublicKey));
        }

        function onPermissionOrAccountRemoval() {
            handleDisconnectWallet();
        }

        async function handleConnectWallet() {
            if (connectionRef.current) return;

            try {
                const connection = await Wallet.Extension.connect({
                    appName: "signarank.io",
                    networkName: Ledger.Network,
                });
                dispatch(appActions.setConnectedAccount(connection.publicKey));

                listenerRef.current = connection.listen({
                    onNetworkChanged: onNetworkChange,
                    onAccountChanged: onAccountChange,
                    onPermissionRemoved: onPermissionOrAccountRemoval,
                    onAccountRemoved: onPermissionOrAccountRemoval,
                });
                connectionRef.current = connection;
            } catch (e) {
                if(e instanceof InvalidNetworkError){
                    dispatch(appActions.setWalletError(`Wrong Network detected. Expected: ${Ledger.Network}`));
                }
                console.error(e);
            }
        }

        window.addEventListener("connect-wallet", handleConnectWallet);
        window.addEventListener("disconnect-wallet", handleDisconnectWallet);

        return () => {
            listenerRef.current?.unlisten();
            window.removeEventListener("connect-wallet", handleConnectWallet);
            window.removeEventListener("disconnect-wallet", handleDisconnectWallet);
        };
    }, []);

    return null;
};
