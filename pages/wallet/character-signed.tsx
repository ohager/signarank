// pages/wallet/character-signed.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { MobileWallet } from '@signumjs/wallets';
import Page from '@components/Page';

const CharacterSignedPage = () => {
    const router = useRouter();
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!router.isReady) return;
        try {
            const { status, transactionId } = MobileWallet.parseSignCallback();
            const returnUrl = (router.query.returnUrl as string) || '/character/create';
            const step = (router.query.step as string) || 'deploy';
            const sep = returnUrl.includes('?') ? '&' : '?';

            if (status === 'success' && transactionId) {
                router.replace(
                    `${returnUrl}${sep}mobileCharacterStatus=success&mobileCharacterStep=${step}&mobileCharacterTxId=${transactionId}`,
                );
            } else if (status === 'rejected') {
                router.replace(`${returnUrl}${sep}mobileCharacterStatus=rejected&mobileCharacterStep=${step}`);
            } else {
                router.replace(`${returnUrl}${sep}mobileCharacterStatus=failed&mobileCharacterStep=${step}`);
            }
        } catch {
            setErrorMessage('Could not process wallet response. Redirecting...');
            const returnUrl = (router.query.returnUrl as string) || '/character/create';
            setTimeout(() => router.replace(returnUrl), 3000);
        }
    }, [router.isReady]);

    return (
        <Page title="Processing - SIGNArank">
            <div className="content" style={{ textAlign: 'center', paddingTop: '4rem' }}>
                {errorMessage ? <p>{errorMessage}</p> : <p>Processing wallet response...</p>}
            </div>
        </Page>
    );
};

export default CharacterSignedPage;
