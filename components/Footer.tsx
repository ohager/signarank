import Link from 'next/link';
import React from 'react';

function Footer() {

    return (
        <div className="min-h-[400px] max-w-[800px] mx-auto my-8 relative max-md:px-0 max-md:py-0">
            <div className="flex justify-center w-full max-md:grid max-md:grid-cols-1 max-md:p-5">
                <div className="text-center">
                    <h3>Join the community</h3>
                    <ul className="m-0 p-0 text-center">
                        <li className="inline-block mr-2.5">
                            <a href="https://twitter.com/signum_official" target="_blank"
                               rel="noreferrer"
                               style={{background: 'url(/twitter.svg) no-repeat', width: 62, height: 62, display: 'block', padding: 0}}>
                                <span className="invisible">Twitter</span>
                            </a>
                        </li>
                        <li className="inline-block mr-2.5">
                            <a href="https://discord.gg/QHZkF4KHDS" target="_blank"
                               rel="noreferrer"
                               style={{background: 'url(/discord.svg) no-repeat', width: 62, height: 62, display: 'block', padding: 0}}>
                                <span className="invisible">Discord</span>
                            </a>
                        </li>
                        <li className="inline-block mr-2.5">
                            <a href="https://t.me/signumnetwork" target="_blank"
                               rel="noreferrer"
                               style={{background: 'url(/telegram.svg) no-repeat', width: 62, height: 62, display: 'block', padding: 0}}>
                                <span className="invisible">Telegram</span>
                            </a>
                        </li>
                    </ul>
                </div>

            </div>

            <div className="grid grid-cols-2 border-t border-white/50 mt-8 pt-[60px] max-md:p-5 max-md:mt-[50px]">
                <div>
                    <h1>SIGNARank</h1>
                    <p>A blockchain adventure.</p>
                    <div className="flex">
                        <a href="https://github.com/signum-network/signum-xt-wallet" rel="noreferrer noopener" target="_blank"><img src='/signum-xt-logo.svg' className="relative -top-[3px] h-7 bg-white/50 rounded-[6px_4px_4px_6px]" alt="Signum XT Wallet"/></a>
                        <a href="https://signum.network" rel="noreferrer noopener" target="_blank"><img src='/powered.svg' className="h-8 w-auto" alt="Powered by Signum"/></a>
                        <a href="https://signum-network.gitbook.io/signumjs" rel="noreferrer noopener" target="_blank"><img src='/signumjs.svg' className="h-8 w-auto relative top-[3px]" alt="SignumJS"/></a>
                    </div>
                </div>
                <div className="justify-self-end text-right">
                    <ul>
                        <li className="my-2.5 list-none"><Link href="/">Home</Link></li>
                        <li className="my-2.5 list-none"><Link href="/leaderboard">Leaderboard</Link></li>
                        <li className="my-2.5 list-none"><Link href="/faqs">FAQs</Link></li>
                        <li className="my-2.5 list-none"><Link href="/api-docs">API</Link></li>
                        <li className="my-2.5 list-none"><Link href="/privacy">Privacy</Link></li>
                        <li className="my-2.5 list-none"><Link href="/terms">Terms of Use</Link></li>
                    </ul>
                </div>
            </div>

            <p className="absolute bottom-0 text-center w-full font-light text-xs opacity-75">All content copyright 2022 &nbsp;
                <a href='https://examp.com/' target='_blank' rel='noreferrer noopener' style={{textDecoration: 'underline'}}>Examp, LLC</a>
                &nbsp;- Permission granted generously for &nbsp;
                <a href='https://digital-independence.dev/' target='_blank' rel='noreferrer noopener' style={{textDecoration: 'underline'}}>Digital Independence Ltda</a>
            </p>
        </div>
    )
}

export default Footer;
