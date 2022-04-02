import { createSlice, PayloadAction } from "@reduxjs/toolkit";


export interface AppState {
  connectedAccount: string | null;
  nodeHost: string;
}

const initialState: AppState = {
  connectedAccount: null,
  nodeHost: "",
};

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
  },
});

export const { actions } = appSlice;
