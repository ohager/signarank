import React, {useMemo, useEffect} from 'react';
import {useQuery} from 'react-query';
import {useAppSelector} from '@states/hooks';
import {selectConnectedAccount} from '@states/appState';
import {Address} from '@signumjs/core';
import {useRouter} from 'next/router';
import NProgress from "nprogress";

export const ScoreHandler: React.FC = ({children}) => {
    const account = useAppSelector(selectConnectedAccount)
    const router = useRouter()

    const accountId = useMemo(() => {
        if (!account) return null;
        return Address.fromPublicKey(account).getNumericId()
    }, [account])


    const {data} = useQuery(`score-${accountId}`, () => {
            if(!accountId) return;
            NProgress.start();
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
