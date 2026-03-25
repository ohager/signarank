import Link from 'next/link';
import React from 'react';
import {ConnectButton} from '@components/ConnectButton';
import {useSeasonInfo} from "@hooks/useSeasonInfo";
import {SeasonBanner} from '@components/SeasonBanner';

const isTestnet = process.env.NEXT_PUBLIC_SIGNUM_NETWORK === "Signum-TESTNET"

const Header = () => {
    const {name} = useSeasonInfo()

    return (
        <div className="p-5 header">
            <h1>
      <span className="flex flex-row items-center">
        <img src='/signum-logo.svg' className="h-8 w-auto" alt='Signum Logo'/>
        <Link href="/">&nbsp;SIGNArank</Link>
          <span className="bg-[var(--main-color3)] text-[10px] uppercase rounded-[10px] px-2.5 py-[3px] ml-1 font-light text-white/75 max-md:hidden">{name}</span>
          {isTestnet && <span className="bg-[var(--main-color3)] text-[10px] uppercase rounded-[10px] px-2.5 py-[3px] ml-1 font-light text-white/75 max-md:hidden" style={{backgroundColor: 'red'}}>TESTNET</span>}
      </span>
            </h1>
            <SeasonBanner/>
            <ul className="list-none p-0 -mt-[30px] text-center relative max-md:mt-[50px]">
                <li className="inline px-5 uppercase opacity-50 hover:opacity-100">
                    <Link href="/">Home</Link>
                </li>
                <li className="inline px-5 uppercase opacity-50 hover:opacity-100">
                    <Link href="/season">Season</Link>
                </li>
                <li className="inline px-5 uppercase opacity-50 hover:opacity-100">
                    <Link href="/leaderboard">Leaderboard</Link>
                </li>
            </ul>
            <div className="absolute right-5 top-[25px] text-right">
                <ConnectButton/>
            </div>
        </div>
    )
}
export default Header;
