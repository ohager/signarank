import {
  combineReducers,
  configureStore,
} from "@reduxjs/toolkit";
import { appSlice } from "./appState";

const rootReducer = combineReducers({
  appState: appSlice.reducer
});

const loadMobileAccount = () => {
  if (typeof window === 'undefined') return undefined;
  const account = localStorage.getItem('signarank_mobile_account');
  if (!account) return undefined;
  return { appState: { connectedAccount: account, nodeHost: '', walletError: '' } };
};

export const store = configureStore({
  reducer: rootReducer,
  preloadedState: loadMobileAccount(),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
