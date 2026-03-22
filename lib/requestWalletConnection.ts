import {MobileWallet} from '@signumjs/wallets';

export const requestWalletConnection = () => {
    window.dispatchEvent(new Event("connect-wallet"));
};

export const requestWalletDisconnection = () => {
    window.dispatchEvent(new Event("disconnect-wallet"));
};

export const requestMobileWalletConnection = (
    mobileWallet: MobileWallet,
    network: string,
    returnUrl: string
) => {
    const callbackUrl = `${window.location.origin}/wallet/connected?returnUrl=${encodeURIComponent(returnUrl)}`;
    mobileWallet.connect({
        callbackUrl,
        appName: 'signarank.io',
        network: network.toLowerCase().includes('testnet') ? 'testnet' : 'mainnet',
    });
};
