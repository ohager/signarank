import '../styles/globals.scss'
import type {AppProps} from 'next/app'
import {QueryClient, QueryClientProvider} from 'react-query'
import {Provider as ReduxProvider} from 'react-redux';
import {store} from '@states/store';
import {AppContextProvider} from '@components/contexts/AppContext';
import { WalletHandler } from '@components/WalletHandler';
import {ScoreHandler} from '@components/ScoreHandler';

const queryClient = new QueryClient();

function App({Component, pageProps}: AppProps) {
    return (
        <AppContextProvider>
            <QueryClientProvider client={queryClient}>
                <ReduxProvider store={store}>
                    <WalletHandler/>
                    <ScoreHandler />
                    <Component {...pageProps} />
                </ReduxProvider>
            </QueryClientProvider>
        </AppContextProvider>
    )
}

export default App
