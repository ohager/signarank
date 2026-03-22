import {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {MobileWallet} from '@signumjs/wallets';
import {useAppDispatch} from '@states/hooks';
import {actions as appActions} from '@states/appState';
import Page from '@components/Page';

const WalletConnectedPage = () => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const [error, setError] = useState('');

    useEffect(() => {
        try {

            const {publicKey} = MobileWallet.parseConnectCallback();
            const returnUrl = (router.query.returnUrl as string) || '/';

            if (publicKey) {
                dispatch(appActions.setConnectedAccount(publicKey));
                router.replace(returnUrl);
            } else if (status === 'rejected') {
                setError('Connection was rejected by the wallet.');
                setTimeout(() => router.replace(returnUrl), 3000);
            } else {
                setError('Connection failed. Please try again.');
                setTimeout(() => router.replace(returnUrl), 3000);
            }
        } catch (e) {
            setError('Invalid callback data. Please try connecting again.');
            const returnUrl = (router.query.returnUrl as string) || '/';
            setTimeout(() => router.replace(returnUrl), 3000);
        }
    }, [router.isReady]);

    return (
        <Page title="Connecting Wallet - SIGNArank">
            <div className="content" style={{textAlign: 'center', paddingTop: '4rem'}}>
                {error ? (
                    <div>
                        <h2>Connection Error</h2>
                        <p>{error}</p>
                        <p>Redirecting...</p>
                    </div>
                ) : (
                    <div>
                        <h2>Connecting your wallet...</h2>
                        <p>Please wait while we verify your connection.</p>
                    </div>
                )}
            </div>
        </Page>
    );
};

export default WalletConnectedPage;
