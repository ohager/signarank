import Link from 'next/link';
import React, {useState} from 'react';
import styles from '../styles/Footer.module.scss';

// import ConnectButton from './ConnectButton';

function Footer() {

    // const [emailAddr, setEmailAddr] = useState("")

    return (
        <div className={styles.footer}>
            <div className={styles.topRow}>
                {/*<div className={styles.form}>*/}

                {/*    <h3>Stay in the loop</h3>*/}

                {/*    <div id="mc_embed_signup">*/}
                {/*        <form*/}
                {/*            action="https://examp.us18.list-manage.com/subscribe/post?u=4118b39975b9020761dfe59c4&amp;id=d2544fe972"*/}
                {/*            method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form"*/}
                {/*            className="validate" target="_blank" noValidate>*/}
                {/*            <div id="mc_embed_signup_scroll">*/}
                {/*                <div className="mc-field-group">*/}
                {/*                    <p><label htmlFor="mce-EMAIL">Sign up for our newsletter to always get the latest*/}
                {/*                        updates</label></p>*/}
                {/*                    <input type="email" onChange={(e) => {*/}
                {/*                        setEmailAddr(e.target.value);*/}
                {/*                    }} value={emailAddr} name="EMAIL" className="required email" id="mce-EMAIL"/>*/}
                {/*                    <input type="submit" value="Subscribe" name="subscribe" id="mc-embedded-subscribe"*/}
                {/*                           className={styles.btn}/>*/}
                {/*                </div>*/}
                {/*                <div id="mce-responses" className="clear foot">*/}
                {/*                    <div className="response" id="mce-error-response" style={{display: "none"}}/>*/}
                {/*                    <div className="response" id="mce-success-response" style={{display: "none"}}/>*/}
                {/*                </div>*/}
                {/*                <div style={{position: "absolute", left: "-5000px"}} aria-hidden="true"><input*/}
                {/*                    type="text" name="b_4118b39975b9020761dfe59c4_d2544fe972" tabIndex={-1}*/}
                {/*                    defaultValue=""/></div>*/}
                {/*            </div>*/}
                {/*        </form>*/}
                {/*    </div>*/}

                {/*</div>*/}
                <div className={styles.social}>
                    <h3>Join the community</h3>
                    <ul>
                        <li className={styles.twitter}><a href="https://twitter.com/signum_official" target="_blank"
                                                          rel="noreferrer"><span>Twitter</span></a></li>
                        <li className={styles.discord}><a href="https://discord.gg/QHZkF4KHDS" target="_blank"
                                                          rel="noreferrer"><span>Discord</span></a></li>
                        {/* <li><a href="">GitHub</a></li> */}
                        <li className={styles.telegram}><a href="https://t.me/signumnetwork" target="_blank"
                                                           rel="noreferrer"><span>Telegram</span></a></li>
                    </ul>
                </div>

            </div>

            <div className={styles.secondRow}>
                <div className={styles.about}>
                    <h1>SIGNARank</h1>
                    <p>A blockchain adventure.</p>
                    <div className={styles.powered}>
                        <a href="https://github.com/signum-network/signum-xt-wallet" rel="noreferrer noopener" target="_blank"><img src='/signum-xt-logo.svg' className={styles.xtwallet} alt="Signum XT Wallet"/></a>
                        <a href="https://signum.network" rel="noreferrer noopener" target="_blank"><img src='/powered.svg' height={32} alt="Powered by Signum"/></a>
                        <a href="https://signum-network.gitbook.io/signumjs" rel="noreferrer noopener" target="_blank"><img src='/signumjs.svg' height={33} alt="SignumJS" style={{position: 'relative', top: '3px'}}/></a>
                    </div>
                </div>
                <div className={styles.links}>
                    <ul>
                        <li><Link href="/"><a>Home</a></Link></li>
                        <li><Link href="/leaderboard"><a>Leaderboard</a></Link></li>
                        <li><Link href="/faqs"><a>FAQs</a></Link></li>
                        <li><Link href="/api-docs"><a>API</a></Link></li>
                        <li><Link href="/privacy"><a>Privacy</a></Link></li>
                        <li><Link href="/terms"><a>Terms of Use</a></Link></li>
                    </ul>
                </div>
            </div>
            {/*
    <h2>Total Transactions: </h2>{totalTransactions}
    <h2>Points possible: </h2>{totalPointsPossible} */}

            <p className={styles.copyright}>All content copyright 2022 &nbsp;
                <a href='https://examp.com/' target='_blank' rel='noreferrer noopener' style={{textDecoration: 'underline'}}>Examp, LLC</a>
                &nbsp;- Permission granted generously for &nbsp;
                <a href='https://digital-independence.dev/' target='_blank' rel='noreferrer noopener' style={{textDecoration: 'underline'}}>Digital Independence Ltda</a>
            </p>
        </div>
    )
}

export default Footer;
