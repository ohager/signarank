import {useQuery} from 'react-query';
import {useAppSelector} from '@states/hooks';
import {selectConnectedAccount} from '@states/appState';
import {Address} from '@signumjs/core';

export const ScoreHandler = () => {
    const account = useAppSelector(selectConnectedAccount)
    const { isLoading, error, data } = useQuery(`score-${account}`, () => {
            if(!account) return null;
            const accountId = Address.fromPublicKey(account).getNumericId()
            return fetch(`/api/score/${accountId}`).then(res => res.json())
        }
    )

    console.log(data)

    return null;
}
