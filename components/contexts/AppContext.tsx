import { FC, createContext, PropsWithChildren } from "react";
import {ExtensionWallet, MobileWallet} from '@signumjs/wallets';

const toStringArray = (csv: any = ""): Array<string> => csv.length ? csv.split(",") :[];

export const Config = {
  Wallet: {
    Extension: new ExtensionWallet(),
    Mobile: new MobileWallet()
  },
  Ledger: {
    DefaultNode: process.env.NEXT_PUBLIC_SIGNUM_DEFAULT_NODE || "http://localhost:6786",
    ReliableNodes: toStringArray(process.env.NEXT_PUBLIC_SIGNUM_RELIABLE_NODES || ""),
    Network: process.env.NEXT_PUBLIC_SIGNUM_NETWORK || "Signum-TESTNET",
  },
  Ipfs:{
    Gateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs",
  }
};

export type AppContextType = typeof Config;

console.debug('Config', JSON.stringify(Config))

export const AppContext = createContext<AppContextType>(Config);

export const AppContextProvider: FC<PropsWithChildren> = ({ children }) => {
  return <AppContext.Provider value={Config}>{children}</AppContext.Provider>;
};
