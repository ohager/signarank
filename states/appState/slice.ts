import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface AppState {
    connectedAccount: string | null;
    nodeHost: string;
    walletError: string;
    isEligibleForBadges: boolean;
}

const initialState: AppState = {
    connectedAccount: null,
    nodeHost: "",
    walletError: "",
    isEligibleForBadges: false,
}

export const appSlice = createSlice({
    name: "app",
    initialState,
    reducers: {
        setConnectedAccount: (state, action: PayloadAction<string | null>) => {
            state.connectedAccount = action.payload;
        },
        setNodeHost: (state, action: PayloadAction<string>) => {
            state.nodeHost = action.payload;
        },
        setWalletError: (state, action: PayloadAction<string>) => {
            state.walletError = action.payload;
        },
        setIsEligibleForBadges : (state, action: PayloadAction<boolean>) => {
            state.isEligibleForBadges = action.payload
        }
    },
});

export const {actions} = appSlice;
