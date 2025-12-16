import Link from 'next/link';
import React from 'react';
import styles from '../styles/Header.module.scss';
import {ConnectButton} from '@components/ConnectButton';

const isTestnet = process.env.NEXT_PUBLIC_SIGNUM_NETWORK === "Signum-TESTNET"

const Header = () => {

  return (
  <div className={`${styles.header} header`}>
    <h1>
      <span className={styles.logo} >
        <img src='/signum-logo.svg' height={32} alt='Signum Logo'/>
        <Link href="/"><a>&nbsp;SIGNArank</a></Link>
        <span className={styles.pill}>Season 1</span>
          {isTestnet && <span className={styles.pill} style={{backgroundColor: 'red'}}>TESTNET</span>}
      </span>
    </h1>
    <ul>
      <li>
        <Link href="/"><a>Home</a></Link>
      </li>
      <li>
        <Link href="/leaderboard"><a>Leaderboard</a></Link>
      </li>
    </ul>
    <div className={styles.btn}>
      <ConnectButton />
    </div>
  </div>
  )
}
export default Header;
