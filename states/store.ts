import {
  combineReducers,
  configureStore,
} from "@reduxjs/toolkit";
import { appSlice } from "./appState";

const rootReducer = combineReducers({
  appState: appSlice.reducer
});

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
