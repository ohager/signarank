import {AppContext, AppContextType} from '@components/contexts/AppContext';
import {useContext} from 'react';

export const useAppContext = (): AppContextType => {
    return useContext(AppContext);
};
