import React from 'react';
import {useQuery} from 'react-query';
import {useAppSelector} from '@states/hooks';
import {selectConnectedAccount} from '@states/appState';
import {Address} from '@signumjs/core';

export const ScoreHandler: React.FC = ({children}) => {
    const account = useAppSelector(selectConnectedAccount)
    const {isLoading, error, data} = useQuery(`score-${account}`, () => {
            console.log('entering...')
            if (!account) return null;
            console.log('reloading...')
            const accountId = Address.fromPublicKey(account).getNumericId()
            return fetch(`/api/score/${accountId}`).then(res => res.json())
        }
    )
    console.log('account', account)
    return (
        <>
            {children};
        </>
    )
}
