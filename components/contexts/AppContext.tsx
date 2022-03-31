import { FC, createContext } from "react";
import {GenericExtensionWallet} from '@signumjs/wallets';

export interface AppContextType {
  Wallet: {
    Extension: GenericExtensionWallet
  };
  Ledger: {
    Network: string;
  };
}

const config: AppContextType = {
  Wallet: {
    Extension: new GenericExtensionWallet()
  },
  Ledger: {
    Network: process.env.NEXT_PUBLIC_SIGNUM_NETWORK || "Signum-TESTNET",
  },
};

export const AppContext = createContext<AppContextType>(config);

export const AppContextProvider: FC = ({ children }) => {
  return <AppContext.Provider value={config}>{children}</AppContext.Provider>;
};
