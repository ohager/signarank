import dynamic from 'next/dynamic';
import Page from '@components/Page';
import {singleQueryString} from '@lib/singleQueryString';
import {createReadOnlyClient} from '@signumjs/core/createReadOnlyClient';
import {ConstructInstanceReadService} from '@signarank/client';
import {R2_CDN_BASE} from '@lib/construct/constants';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';
import type {GetStaticPaths, GetStaticProps} from 'next';

interface ConstructPreview {
    contractId: string;
    name: string;
    description: string;
    imageUrl: string;
}

interface ConstructPageProps {
    preview: ConstructPreview | null;
}

const SITE_URL = 'https://signarank.club';

const ConstructPageBody = dynamic(
    () => import('@components/Construct/ConstructPageBody'),
    {
        ssr: false,
        loading: () => (
            <div className="content-area">
                <div className="glass-static p-12 flex justify-center items-center min-h-[300px]">
                    <span
                        className="text-[var(--text-dim)] text-lg"
                        style={{fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic'}}
                    >
                        Loading construct data...
                    </span>
                </div>
            </div>
        ),
    }
);

export const getStaticPaths: GetStaticPaths = async () => {
    return {
        paths: [],
        fallback: 'blocking'
    };
};

const toStringArray = (csv: string = ''): string[] => csv.split(',').filter(Boolean);

export const getStaticProps: GetStaticProps<ConstructPageProps> = async ({params}) => {
    const contractId = singleQueryString(params?.contractId);

    if (!contractId) {
        return {props: {preview: null}, revalidate: ISR_REVALIDATE_SECONDS};
    }

    try {
        const ledger = createReadOnlyClient({
            nodeHost: process.env.NEXT_PUBLIC_SIGNUM_DEFAULT_NODE || '',
            reliableNodeHosts: toStringArray(process.env.NEXT_PUBLIC_SIGNUM_RELIABLE_NODES)
        });

        const service = new ConstructInstanceReadService(
            {ledger, contractCodeHash: '', greenContractReference: ''},
            contractId
        );
        const metadata = await service.getMetadata();

        const imageUrl = (metadata.getCustomField('xav') as string) ?? `${R2_CDN_BASE}/${metadata.avatar.ipfsCid}` ?? '';

        return {
            props: {
                preview: {
                    contractId,
                    name: metadata.name || 'Unknown Construct',
                    description: metadata.description || 'A Signum on-chain construct. Attack to deal damage and earn rewards.',
                    imageUrl
                }
            },
            revalidate: ISR_REVALIDATE_SECONDS
        };
    } catch (e) {
        console.error('construct getStaticProps failed', contractId, e);
        return {props: {preview: null}, revalidate: ISR_REVALIDATE_SECONDS};
    }
};

const ConstructPage = ({preview}: ConstructPageProps) => {
    const title = preview ? `${preview.name} - SIGNArank` : 'Construct - SIGNArank';
    const description = preview?.description;
    const ogImage = preview?.imageUrl || undefined;
    const ogUrl = preview ? `${SITE_URL}/construct/${preview.contractId}` : undefined;

    return (
        <Page
            title={title}
            description={description}
            ogImage={ogImage}
            ogUrl={ogUrl}
        >
            <ConstructPageBody initialContractId={preview?.contractId}/>
        </Page>
    );
};

export default ConstructPage;
