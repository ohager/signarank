import Link from 'next/link';
import React from 'react';
import styles from '../styles/Header.module.scss';
import {ConnectButton} from '@components/ConnectButton';
import {useSeasonInfo} from "@hooks/useSeasonInfo";

const isTestnet = process.env.NEXT_PUBLIC_SIGNUM_NETWORK === "Signum-TESTNET"

const Header = () => {
    const {name, isCurrent, description} = useSeasonInfo()
    return (
        <div className={`${styles.header} header`}>
            <h1>
      <span className={styles.logo}>
        <img src='/signum-logo.svg' height={32} alt='Signum Logo'/>
        <Link href="/"><a>&nbsp;SIGNArank</a></Link>
          {isTestnet && <span className={styles.pill} style={{backgroundColor: 'red'}}>TESTNET</span>}
      </span>
            </h1>
            {isCurrent && description && (
                <div className={styles.seasonBanner}>
                    <span className={styles.seasonName}>{name}</span>
                    <p className={styles.seasonDescription}>{description}</p>
                </div>
            )}
            <ul>
                <li>
                    <Link href="/"><a>Home</a></Link>
                </li>
                <li>
                    <Link href="/leaderboard"><a>Leaderboard</a></Link>
                </li>
            </ul>
            <div className={styles.btn}>
                <ConnectButton/>
            </div>
        </div>
    )
}
export default Header;
