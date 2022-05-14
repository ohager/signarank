import Head from 'next/head'
import {ReactNode} from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import styles from '../styles/Home.module.scss'
import {isClientSide} from '@lib/isClientSide';

// add to this every new season
export const seasons = [
    'achievements_season1',
    'achievements_season2'
];

interface PageProps {
    children: ReactNode,
    title: string
}

const Page = (props: PageProps) => {

    return (
        <div className={styles.container}>
            <Head>
                <title>{props.title}</title>
                <title>SignaRank - Check your Signum Blockchain Score</title>
                <meta name="title" content="SignaRank - Check your Signum Blockchain Score"/>
                <meta name="description"
                      content="An achievement system built on the Signum blockchain.  The more chain activity the higher your score. Compare yourself with others."/>

                <meta property="og:type" content="website"/>
                <meta property="og:url" content="https://signarank.club"/>
                <meta property="og:title" content="SignaRank - Check your Signum Blockchain Score"/>
                <meta property="og:description"
                      content="An achievement system built on the Signum blockchain.  The more chain activity the higher your score. Compare yourself with others."/>
                <meta property="og:image"
                      content="https://signarank.club/card.jpg"/>

                <meta property="twitter:card" content="summary_large_image"/>
                <meta property="twitter:url" content="https://signarank.club"/>
                <meta property="twitter:title" content="SignaRank - Check your Signum Blockchain Score"/>
                <meta property="twitter:description"
                      content="An achievement system built on the Signum blockchain.  The more chain activity the higher your score. Compare yourself with others."/>
                <meta property="twitter:image"
                      content="https://signarank.club/card.jpg"/>
                <meta name="description" content="SIGNArank - An achievement system built on the Signum blockchain."/>
                <link rel="icon" href="/favicon.ico"/>
                <link rel="apple-touch-icon" sizes="57x57" href="/apple-icon-57x57.png"/>
                <link rel="apple-touch-icon" sizes="60x60" href="/apple-icon-60x60.png"/>
                <link rel="apple-touch-icon" sizes="72x72" href="/apple-icon-72x72.png"/>
                <link rel="apple-touch-icon" sizes="76x76" href="/apple-icon-76x76.png"/>
                <link rel="apple-touch-icon" sizes="114x114" href="/apple-icon-114x114.png"/>
                <link rel="apple-touch-icon" sizes="120x120" href="/apple-icon-120x120.png"/>
                <link rel="apple-touch-icon" sizes="144x144" href="/apple-icon-144x144.png"/>
                <link rel="apple-touch-icon" sizes="152x152" href="/apple-icon-152x152.png"/>
                <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon-180x180.png"/>
                <link rel="icon" type="image/png" sizes="192x192" href="/android-icon-192x192.png"/>
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"/>
                <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png"/>
                <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"/>
                <link rel="manifest" href="/manifest.json"/>
                <meta name="msapplication-TileColor" content="#000000"/>
                <meta name="msapplication-TileImage" content="/ms-icon-144x144.png"/>
                <meta name="theme-color" content="#000000"/>
            </Head>

            <Header/>

            <main className={styles.main}>
                {props.children}
            </main>

            <Footer/>
        </div>
    )
}

export default Page
