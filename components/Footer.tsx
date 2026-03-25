import Link from 'next/link';
import React from 'react';

function Footer() {
    return (
        <footer className="border-t border-[var(--glass-border)] mt-20">
            <div className="max-w-[1300px] mx-auto px-8 py-10 flex justify-between items-center max-md:flex-col max-md:gap-6 max-md:text-center">
                {/* Logo */}
                <div className="flex items-center gap-2" style={{fontFamily: "'Cinzel', serif", fontWeight: 700, letterSpacing: '0.15em'}}>
                    <div className="w-7 h-7 border-2 border-[var(--gold)] rounded-full flex items-center justify-center overflow-hidden">
                        <img src="/signum-logo.svg" alt="Signum" className="w-4 h-4" />
                    </div>
                    <span className="text-sm">SIGNA<span className="text-[var(--gold)]">RANK</span></span>
                </div>

                {/* Links */}
                <nav className="flex gap-7">
                    <Link href="/" className="text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">Home</Link>
                    <Link href="/leaderboard" className="text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">Leaderboard</Link>
                    <Link href="/faqs" className="text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">FAQs</Link>
                    <Link href="/api-docs" className="text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">API</Link>
                    <Link href="/privacy" className="text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">Privacy</Link>
                    <Link href="/terms" className="text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors">Terms</Link>
                </nav>

                {/* Powered by */}
                <div className="flex items-center gap-3">
                    <a href="https://signum.network" rel="noreferrer noopener" target="_blank">
                        <img src='/powered.svg' className="h-7 w-auto opacity-50 hover:opacity-80 transition-opacity" alt="Powered by Signum"/>
                    </a>
                </div>
            </div>
        </footer>
    )
}

export default Footer;
