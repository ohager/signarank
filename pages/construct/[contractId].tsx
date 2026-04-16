import type {GetStaticPaths, GetStaticProps} from 'next';
import Page from '@components/Page';
import ConstructPageBody from '@components/Construct/ConstructPageBody';
import {createReadOnlyClient} from '@signumjs/core/createReadOnlyClient';
import {ConstructInstanceReadService} from '@signarank/client';
import {singleQueryString} from '@lib/singleQueryString';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';
import {R2_CDN_BASE} from '@lib/construct/constants';

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

export const getStaticPaths: GetStaticPaths = async () => ({
    paths: [],
    fallback: 'blocking',
});

const toStringArray = (csv: string = ''): string[] => csv.split(',').filter(Boolean);

export const getStaticProps: GetStaticProps<ConstructPageProps> = async ({params}) => {
    const contractId = singleQueryString(params?.contractId);
    if (!contractId) {
        return {props: {preview: null}, revalidate: ISR_REVALIDATE_SECONDS};
    }

    try {
        const ledger = createReadOnlyClient({
            nodeHost: process.env.NEXT_PUBLIC_SIGNUM_DEFAULT_NODE || '',
            reliableNodeHosts: toStringArray(process.env.NEXT_PUBLIC_SIGNUM_RELIABLE_NODES),
        });

        const service = new ConstructInstanceReadService(
            {ledger, contractCodeHash: '', greenContractReference: ''},
            contractId,
        );
        const metadata = await service.getMetadata();

        const customImage = metadata.getCustomField('xav') as string | undefined;
        const avatarImage = metadata.avatar ? `${R2_CDN_BASE}/${metadata.avatar.ipfsCid}` : '';
        const imageUrl = customImage || avatarImage || '';

        return {
            props: {
                preview: {
                    contractId,
                    name: metadata.name || 'Unknown Construct',
                    description: metadata.description || 'A Signum on-chain construct. Attack to deal damage and earn rewards.',
                    imageUrl,
                },
            },
            revalidate: ISR_REVALIDATE_SECONDS,
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
        <Page title={title} description={description} ogImage={ogImage} ogUrl={ogUrl}>
            <ConstructPageBody initialContractId={preview?.contractId}/>
        </Page>
    );
};

export default ConstructPage;
