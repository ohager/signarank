import Head from 'next/head'
import {ReactNode} from 'react'
import Footer from '../components/Footer'
import Header from '../components/Header'
import VideoBackground from '../components/VideoBackground'
import seasonsData from '../lib/seasons.json'

interface PageProps {
    children: ReactNode,
    title: string,
    description?: string,
    ogImage?: string,
    ogImageAlt?: string,
    ogUrl?: string,
    ogTitle?: string,
    canonical?: string,
}

const DEFAULT_DESCRIPTION = "An achievement system built on the Signum blockchain. The more chain activity the higher your score. Compare yourself with others.";
const DEFAULT_OG_TITLE = "SignaRank - Check your Signum Blockchain Score";
const DEFAULT_OG_IMAGE = "https://signarank.club/card.jpg";
const DEFAULT_OG_URL = "https://signarank.club";

const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max - 1) + '…' : text;

const Page = (props: PageProps) => {
    const videoUrl = seasonsData.bloombrawl?.background || '';
    const rawDescription = props.description ?? DEFAULT_DESCRIPTION;
    const description = truncate(rawDescription, 155);
    const ogTitle = props.ogTitle ?? props.title ?? DEFAULT_OG_TITLE;
    const ogImage = props.ogImage ?? DEFAULT_OG_IMAGE;
    const ogImageAlt = props.ogImageAlt ?? ogTitle;
    const ogUrl = props.ogUrl ?? DEFAULT_OG_URL;
    const canonical = props.canonical ?? ogUrl;

    return (
        <>
            {videoUrl && <VideoBackground videoUrl={videoUrl} />}

            <div className="relative z-10 min-h-screen flex flex-col">
                <Head>
                    <title>{props.title}</title>
                    <meta name="title" content={ogTitle}/>
                    <meta name="description" content={description}/>
                    <link rel="canonical" href={canonical}/>

                    <meta property="og:type" content="website"/>
                    <meta property="og:url" content={ogUrl}/>
                    <meta property="og:title" content={ogTitle}/>
                    <meta property="og:description" content={description}/>
                    <meta property="og:image" content={ogImage}/>
                    <meta property="og:image:alt" content={ogImageAlt}/>

                    <meta property="twitter:card" content="summary_large_image"/>
                    <meta property="twitter:url" content={ogUrl}/>
                    <meta property="twitter:title" content={ogTitle}/>
                    <meta property="twitter:description" content={description}/>
                    <meta property="twitter:image" content={ogImage}/>
                    <meta property="twitter:image:alt" content={ogImageAlt}/>

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
