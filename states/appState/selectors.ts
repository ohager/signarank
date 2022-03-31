import {RootState} from '../store';

export const selectConnectedAccount = (state: RootState): string | null => state.appState.connectedAccount
export const selectIsConnected = (state: RootState): boolean => state.appState.connectedAccount !== null;
