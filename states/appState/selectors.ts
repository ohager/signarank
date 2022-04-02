import {RootState} from '../store';

export const selectConnectedAccount = (state: RootState): string | null => state.appState.connectedAccount
export const selectNodeHost = (state: RootState): string | null => state.appState.nodeHost
