// pages/wallet/character-signed.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { MobileWallet } from '@signumjs/wallets';
import Page from '@components/Page';

const isSafeReturnUrl = (url: string): boolean => url.startsWith('/') && !url.startsWith('//');

const CharacterSignedPage = () => {
    const router = useRouter();
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!router.isReady) return;
        const rawReturnUrl = router.query.returnUrl as string;
        const returnUrl = rawReturnUrl && isSafeReturnUrl(rawReturnUrl) ? rawReturnUrl : '/character/create';
        try {
            const { status, transactionId } = MobileWallet.parseSignCallback();
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
