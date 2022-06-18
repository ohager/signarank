import {useRouter} from 'next/router'
import styles from '../../styles/Address.module.scss'
import achievements from '@lib/achievements.signa.json';
import Link from 'next/link';
import ProgressBar from '../../components/ProgressBar';
import Score from '../../components/Score';
import {useEffect} from 'react';
import {NextPageContext} from 'next';
import 'chart.js/auto';
import {Radar} from 'react-chartjs-2';
import Page from '../../components/Page';
import {calculateScore} from '../api/score/calculateSignaScore';
import {useReedSolomonAddress} from '@hooks/useReedSolomonAddress';
import {singleQueryString} from '@lib/singleQueryString';
import {useAppDispatch, useAppSelector} from '@states/hooks';
import {actions, selectIsEligibleForBadges} from '@states/appState';
import {useConnectedAccount} from '@hooks/useConnectedAccount';

export async function getServerSideProps(context: NextPageContext) {
    const {address} = context.query;
    return calculateScore(singleQueryString(address));
}

export interface AddressProps {
    address: string,
    score: number,
    rank: number,
    progress: Array<string>,
    error: boolean | string,
    name?: string
}

const Address = ({address, score, rank, progress, error, name}: AddressProps) => {
    const router = useRouter()
    const displayAddress = useReedSolomonAddress(address)
    const connectedAccount = useConnectedAccount()
    const dispatch = useAppDispatch()
    const isEligibleForBadges = useAppSelector(selectIsEligibleForBadges)

    useEffect(() => {
        if (error) {
            router.push('/error');
        }
    });

    useEffect(() => {
        if(!isEligibleForBadges){
            router.back()
        }
    }, [isEligibleForBadges]);

    return <Page title={`${displayAddress} - SIGNARank`}>
        <div className="content">
            <div className={styles.address}>
                <h2 className="gradient-box gradient-bottom-only">{name || displayAddress}</h2>
            </div>
            <Score score={score} rank={rank}/>
        </div>
    </Page>
}

export default Address
