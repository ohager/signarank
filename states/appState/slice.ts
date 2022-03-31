import { createSlice, PayloadAction } from "@reduxjs/toolkit";


export interface AppState {
  connectedAccount: string | null;
}

const initialState: AppState = {
  connectedAccount: null,
};

export const appSlice = createSlice({
  name: "app",
  initialState,
  reducers: {
    setConnectedAccount: (state, action: PayloadAction<string | null>) => {
      state.connectedAccount = action.payload;
    },
  },
});

export const { actions } = appSlice;
