import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface AppState {
    connectedAccount: string | null;
    nodeHost: string;
    walletError: string;
}

const initialState: AppState = {
    connectedAccount: null,
    nodeHost: "",
    walletError: ""
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
        }
    },
});

export const {actions} = appSlice;
