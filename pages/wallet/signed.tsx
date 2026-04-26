import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { MobileWallet } from '@signumjs/wallets';
import Page from '@components/Page';

const WalletSignedPage = () => {
    const router = useRouter();
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!router.isReady) return;
        try {
            const { status, transactionId } = MobileWallet.parseSignCallback();
            const returnUrl = (router.query.returnUrl as string) || '/';
            const sep = returnUrl.includes('?') ? '&' : '?';

            if (status === 'success' && transactionId) {
                router.replace(`${returnUrl}${sep}mobileAttackStatus=success&mobileAttackTxId=${transactionId}`);
            } else if (status === 'rejected') {
                router.replace(`${returnUrl}${sep}mobileAttackStatus=rejected`);
            } else {
                router.replace(`${returnUrl}${sep}mobileAttackStatus=failed`);
            }
        } catch {
            setErrorMessage('Could not process wallet response. Redirecting...');
            const returnUrl = (router.query.returnUrl as string) || '/';
            setTimeout(() => router.replace(returnUrl), 3000);
        }
    }, [router.isReady]);

    return (
        <Page title="Processing - SIGNArank">
            <div className="content" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                {errorMessage ? (
                    <p>{errorMessage}</p>
                ) : (
                    <p>Processing wallet response...</p>
                )}
            </div>
        </Page>
    );
};

export default WalletSignedPage;
