import Link from 'next/link';
import React, {useState, useEffect} from 'react';
import {ConnectButton} from '@components/ConnectButton';
import {SeasonBanner} from '@components/SeasonBanner';
import {useRouter} from 'next/router';

const Header = () => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const router = useRouter();

    // Close menu on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [router.asPath]);

    return (
        <header className="sticky top-0 z-50 bg-[rgba(8,6,12,0.6)] backdrop-blur-[30px] saturate-[1.2] border-b border-[var(--glass-border)]">
            <div className="max-w-[1300px] mx-auto px-4 md:px-8 h-[60px] md:h-[70px] flex items-center justify-between">
                {/* Logo + Season Badge */}
                <div className="flex items-center gap-3 md:gap-4">
                    <Link href="/" className="flex items-center gap-2 md:gap-2.5 text-lg md:text-xl tracking-[0.15em]" style={{fontFamily: "'Cinzel', serif", fontWeight: 700}}>
                        <div className="w-8 h-8 md:w-9 md:h-9 border-2 border-[var(--gold)] rounded-full flex items-center justify-center overflow-hidden relative">
                            <img src="/signum-logo.svg" alt="Signum" className="w-4 h-4 md:w-5 md:h-5" />
                            <div className="absolute inset-[3px] border border-[var(--gold-dim)] rounded-full pointer-events-none"/>
                        </div>
                        <span>SIGNA<span className="text-[var(--gold)]">RANK</span></span>
                    </Link>
                    <div className="hidden md:block">
                        <SeasonBanner/>
                    </div>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-7">
                    <Link href="/" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Home</Link>
                    <Link href="/season" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Season</Link>
                    <Link href="/leaderboard" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Leaderboard</Link>
                    <Link href="/rules" className="text-[0.7rem] font-semibold tracking-[0.18em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors" style={{fontFamily: "'Cinzel', serif"}}>Rules</Link>
                </nav>

                {/* Desktop Wallet */}
                <div className="hidden md:block">
                    <ConnectButton/>
                </div>

                {/* Mobile hamburger */}
                <button
                    onClick={() => setMobileOpen(!mobileOpen)}
                    className="md:hidden flex flex-col gap-1.5 p-2 relative z-[60]"
                    aria-label="Toggle menu"
                >
                    <span className={`block w-5 h-[1.5px] bg-[var(--text)] transition-all duration-200 origin-center ${mobileOpen ? 'rotate-45 translate-y-[4.5px]' : ''}`}/>
                    <span className={`block w-5 h-[1.5px] bg-[var(--text)] transition-all duration-200 origin-center ${mobileOpen ? '-rotate-45 -translate-y-[1.5px]' : ''}`}/>
                </button>
            </div>

            {/* Mobile dropdown overlay */}
            <div className={`md:hidden absolute left-0 right-0 top-full transition-all duration-250 ${mobileOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
                <div className="bg-[rgba(6,4,10,0.96)] backdrop-blur-[40px] border-b border-[var(--glass-border)] shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                    <nav className="flex flex-col px-4 pt-3 pb-2">
                        <Link href="/" className="py-3 text-[0.75rem] font-semibold tracking-[0.15em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors border-b border-[var(--glass-border)]" style={{fontFamily: "'Cinzel', serif"}}>Home</Link>
                        <Link href="/season" className="py-3 text-[0.75rem] font-semibold tracking-[0.15em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors border-b border-[var(--glass-border)]" style={{fontFamily: "'Cinzel', serif"}}>Season</Link>
                        <Link href="/leaderboard" className="py-3 text-[0.75rem] font-semibold tracking-[0.15em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors border-b border-[var(--glass-border)]" style={{fontFamily: "'Cinzel', serif"}}>Leaderboard</Link>
                        <Link href="/rules" className="py-3 text-[0.75rem] font-semibold tracking-[0.15em] uppercase text-[var(--text-dim)] hover:text-[var(--gold)] transition-colors border-b border-[var(--glass-border)]" style={{fontFamily: "'Cinzel', serif"}}>Rules</Link>
                    </nav>
                    <div className="px-4 py-4 border-t border-[var(--glass-border)] flex justify-center">
                        <ConnectButton/>
                    </div>
                </div>
            </div>

            {/* Backdrop to close menu on tap outside */}
            {mobileOpen && (
                <div className="md:hidden fixed inset-0 top-[60px] z-[-1]" onClick={() => setMobileOpen(false)} />
            )}
        </header>
    )
}
export default Header;
