import Link from 'next/link';
import React from 'react';
import styles from '../styles/Header.module.scss';
import {ConnectButton} from '@components/ConnectButton';
import {useAppSelector} from '@states/hooks';
import {selectConnectedAccount, selectIsEligibleForBadges} from '@states/appState';
import {useConnectedAccount} from '@hooks/useConnectedAccount';

const Header = () => {
  const showBadges = useAppSelector(selectIsEligibleForBadges)
  const account = useConnectedAccount()

  return (
  <div className={`${styles.header} header`}>
    <h1>
      <span className={styles.logo} >
        <img src='/signum-logo.svg' height={32} alt='Signum Logo'/>
        <Link href="/"><a>&nbsp;SIGNArank</a></Link>
        <span className={styles.pill}>Season 1</span>
      </span>
    </h1>
    <ul>
      <li>
        <Link href="/"><a>Home</a></Link>
      </li>
      <li>
        <Link href="/leaderboard"><a>Leaderboard</a></Link>
      </li>
      { showBadges && account &&
        <li>
          <Link href={`/badges/${account.getNumericId()}`}><a>Badges</a></Link>
        </li>
      }
    </ul>
    <div className={styles.btn}>
      <ConnectButton />
    </div>
  </div>
  )
}
export default Header;
