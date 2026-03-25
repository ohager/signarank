import Link from 'next/link';
import React from 'react';
import {ConnectButton} from '@components/ConnectButton';
import {SeasonBanner} from '@components/SeasonBanner';

const Header = () => {
    return (
        <header className="sticky top-0 z-50 bg-[rgba(8,6,12,0.6)] backdrop-blur-[30px] saturate-[1.2] border-b border-[var(--glass-border)]">
            <div className="max-w-[1300px] mx-auto px-8 h-[70px] flex items-center justify-between">
                {/* Logo + Season Badge */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-2.5 text-xl tracking-[0.15em]" style={{fontFamily: "'Cinzel', serif", fontWeight: 700}}>
                        <div className="w-9 h-9 border-2 border-[var(--gold)] rounded-full flex items-center justify-center overflow-hidden relative">
                            <img src="/signum-logo.svg" alt="Signum" className="w-5 h-5" />
                            <div className="absolute inset-[3px] border border-[var(--gold-dim)] rounded-full pointer-events-none"/>
                        </div>
                        <span>SIGNA<span className="text-[var(--gold)]">RANK</span></span>
                    </Link>
                    <SeasonBanner/>
                </div>

                {/* Navigation */}
                <nav className="flex items-center gap-7 max-md:hidden">
                    <Link href="/" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Home</Link>
                    <Link href="/season" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Season</Link>
                    <Link href="/leaderboard" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Leaderboard</Link>
                </nav>

                {/* Wallet */}
                <div className="max-md:hidden">
                    <ConnectButton/>
                </div>
            </div>
        </header>
    )
}
export default Header;
