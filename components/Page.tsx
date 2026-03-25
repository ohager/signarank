import Head from 'next/head'
import {ReactNode} from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import VideoBackground from '../components/VideoBackground'
import FallingIcons from './FallingIcons'
import seasonsData from '../lib/seasons.json'

export const seasons = [
    'achievements_season1',
    'achievements_season2'
];

interface PageProps {
    children: ReactNode,
    title: string
}

const Page = (props: PageProps) => {
    const videoUrl = seasonsData.bloombrawl?.background || '';

    return (
        <>
            {videoUrl && <VideoBackground videoUrl={videoUrl} />}
            <FallingIcons emojis={['🌼','🌺', '🌸']} />

            <div className="relative z-10 min-h-screen flex flex-col">
                <Head>
                    <title>{props.title}</title>
                    <meta name="title" content="SignaRank - Check your Signum Blockchain Score"/>
                    <meta name="description"
                          content="An achievement system built on the Signum blockchain. The more chain activity the higher your score. Compare yourself with others."/>

                    <meta property="og:type" content="website"/>
                    <meta property="og:url" content="https://signarank.club"/>
                    <meta property="og:title" content="SignaRank - Check your Signum Blockchain Score"/>
                    <meta property="og:description"
                          content="An achievement system built on the Signum blockchain. The more chain activity the higher your score. Compare yourself with others."/>
                    <meta property="og:image" content="https://signarank.club/card.jpg"/>

                    <meta property="twitter:card" content="summary_large_image"/>
                    <meta property="twitter:url" content="https://signarank.club"/>
                    <meta property="twitter:title" content="SignaRank - Check your Signum Blockchain Score"/>
                    <meta property="twitter:description"
                          content="An achievement system built on the Signum blockchain. The more chain activity the higher your score. Compare yourself with others."/>
                    <meta property="twitter:image" content="https://signarank.club/card.jpg"/>

                    <link rel="icon" href="/favicon.ico"/>
                    <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon-180x180.png"/>
                    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"/>
                    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"/>
                    <link rel="manifest" href="/manifest.json"/>
                    <meta name="theme-color" content="#080610"/>
                </Head>

                <Header/>

                <main className="flex-1">
                    {props.children}
                </main>

                <Footer/>
            </div>
        </>
    )
}

export default Page
