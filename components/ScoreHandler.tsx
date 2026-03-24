import React, {useMemo, useEffect, PropsWithChildren} from 'react';
import {useQuery} from '@tanstack/react-query';
import {useAppSelector} from '@states/hooks';
import {selectConnectedAccount} from '@states/appState';
import {Address} from '@signumjs/core';
import NProgress from "nprogress";

export const ScoreHandler: React.FC<PropsWithChildren> = ({children}) => {
    const account = useAppSelector(selectConnectedAccount)

    const accountId = useMemo(() => {
        if (!account) return null;
        return Address.fromPublicKey(account).getNumericId()
    }, [account])


    const {data} = useQuery({
        queryKey: ['score', accountId],
        queryFn: () => {
            if(!accountId) return;
            NProgress.start();
            return fetch(`/api/score/${accountId}`).then(res => res.json())
        },
        enabled: !!accountId,
    })
    useEffect(() => {
        if (data) {
            NProgress.done();
        }
    }, [data])

    return (
        <>
            {children}
        </>
    )
}
