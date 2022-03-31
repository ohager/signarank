import Link from 'next/link';
import React from 'react';
import styles from '../styles/Header.module.scss';
import {ConnectButton} from '@components/ConnectButton';

const Header = () => {

  return (
  <div className={`${styles.header} header`}>
    <h1><Link href="/"><a>SIGNArank</a></Link> <span className={styles.pill}>Season 1</span></h1>
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
