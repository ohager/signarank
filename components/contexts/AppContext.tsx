import { FC, createContext } from "react";
import {GenericExtensionWallet} from '@signumjs/wallets';

const toStringArray = (csv: any = ""): Array<string> => csv.length ? csv.split(",") :[];

export interface AppContextType {
  Wallet: {
    Extension: GenericExtensionWallet
  };
  Ledger: {
    ReliableNodes: string[];
    DefaultNode: string;
    Network: string;
  };
}

const config: AppContextType = {
  Wallet: {
    Extension: new GenericExtensionWallet()
  },
  Ledger: {
    DefaultNode: process.env.NEXT_PUBLIC_SIGNUM_DEFAULT_NODE || "http://localhost:6786",
    ReliableNodes: toStringArray(process.env.NEXT_PUBLIC_SIGNUM_RELIABLE_NODES || ""),
    Network: process.env.NEXT_PUBLIC_SIGNUM_NETWORK || "Signum-TESTNET",
  },
};

console.debug('Config', JSON.stringify(config))

export const AppContext = createContext<AppContextType>(config);

export const AppContextProvider: FC = ({ children }) => {
  return <AppContext.Provider value={config}>{children}</AppContext.Provider>;
};
