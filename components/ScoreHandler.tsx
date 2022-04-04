import React, {useMemo, useEffect} from 'react';
import {useQuery} from 'react-query';
import {useAppDispatch, useAppSelector} from '@states/hooks';
import {selectConnectedAccount, actions} from '@states/appState';
import {Address} from '@signumjs/core';
import {useRouter} from 'next/router';

export const ScoreHandler: React.FC = ({children}) => {
    const account = useAppSelector(selectConnectedAccount)
    const dispatch = useAppDispatch()
    const router = useRouter()

    const accountId = useMemo(() => {
        if (!account) return null;
        return Address.fromPublicKey(account).getNumericId()
    }, [account])


    const {data} = useQuery(`score-${accountId}`, () => {
            if(!accountId) return;
            return fetch(`/api/score/${accountId}`).then(res => res.json())
        }
    )
    useEffect(() => {
        if (data && accountId) {
            router.push(`/address/${accountId}`)
        }

    }, [data])

    return (
        <>
            {children};
        </>
    )
}
