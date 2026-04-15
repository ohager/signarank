import {useRouter} from 'next/router';
import Page from '@components/Page';
import {ConstructCard} from '@components/Construct/ConstructCard';
import {AttackForm} from '@components/Construct/AttackForm';
import {AttackHistory} from '@components/Construct/AttackHistory';
import {PlayerStatusPanel} from '@components/Construct/PlayerStatusPanel';
import {useConstruct} from '@hooks/useConstruct';
import {useUserCooldown} from '@hooks/useUserCooldown';
import {usePlayerConstructStats} from '@hooks/usePlayerConstructStats';
import {useAppSelector} from '@states/hooks';
import {selectConnectedAccount} from '@states/appState';
import {singleQueryString} from '@lib/singleQueryString';
import {Address} from '@signumjs/core';
import {createReadOnlyClient} from '@signumjs/core/createReadOnlyClient';
import {ConstructInstanceReadService} from '@signarank/client';
import {R2_CDN_BASE} from '@lib/construct/constants';
import {ISR_REVALIDATE_SECONDS} from '@lib/cacheConfig';
import Link from 'next/link';
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

        const service = new ConstructInstanceReadService({ledger, contractCodeHash: '', greenContractReference: ''}, contractId);
        const metadata = await service.getMetadata();

        const imageUrl = metadata.getCustomField('xav') as string ?? `${R2_CDN_BASE}/${metadata.avatar.ipfsCid}` ?? ''

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
    const router = useRouter();
    const contractId = singleQueryString(router.query.contractId) || preview?.contractId || '';
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const {construct, loading, error} = useConstruct(contractId || null);

    // Convert public key to account ID for cooldown check
    let userAccountId: string | null = null;
    if (connectedAccount) {
        try {
            userAccountId = Address.fromPublicKey(connectedAccount).getNumericId();
        } catch {
            // Invalid public key
        }
    }

    // Check cooldown status
    const cooldownStatus = useUserCooldown(
        contractId || null,
        userAccountId,
        construct?.coolDownInBlocks ?? 0
    );

    // Player per-construct stats (damage, XP, debuff)
    const {stats: playerStats, loading: playerStatsLoading} = usePlayerConstructStats({
        contractId: contractId || null,
        userAccountId,
        hpTokenId: construct?.hpTokenId ?? null,
        xpTokenId: construct?.xpTokenId ?? null,
        debuffDamageReduction: construct?.debuffDamageReduction ?? 0,
        debuffMaxStack: construct?.debuffMaxStack ?? 0,
    });

    const previewTitle = preview ? `${preview.name} - SIGNArank` : 'Loading Construct - SIGNArank';
    const previewOgImage = preview?.imageUrl || undefined;
    const previewDescription = preview?.description || undefined;
    const previewOgUrl = preview ? `${SITE_URL}/construct/${preview.contractId}` : undefined;

    if (loading) {
        return (
            <Page
                title={previewTitle}
                description={previewDescription}
                ogImage={previewOgImage}
                ogUrl={previewOgUrl}
            >
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
            </Page>
        );
    }

    if (error || !construct) {
        return (
            <Page
                title={previewTitle}
                description={previewDescription}
                ogImage={previewOgImage}
                ogUrl={previewOgUrl}
            >
                <div className="content-area">
                    <div className="glass-static p-12 flex flex-col justify-center items-center min-h-[300px] text-center gap-4">
                        <h2
                            className="text-[1.4rem] font-semibold text-[var(--ember)]"
                            style={{fontFamily: "'Cinzel', serif"}}
                        >
                            Failed to load construct
                        </h2>
                        <p
                            className="text-[var(--text-dim)]"
                            style={{fontFamily: "'Cormorant Garamond', serif"}}
                        >
                            {error || 'Construct not found'}
                        </p>
                        <Link
                            href="/"
                            className="text-[var(--gold)] hover:text-[var(--gold-bright)] transition-colors text-sm tracking-wide"
                            style={{fontFamily: "'IBM Plex Mono', monospace"}}
                        >
                            Return to Home
                        </Link>
                    </div>
                </div>
            </Page>
        );
    }

    return (
        <Page
            title={`${construct.name} - SIGNArank`}
            description={construct.description || previewDescription}
            ogImage={construct.imageUrl || previewOgImage}
            ogUrl={previewOgUrl || `${SITE_URL}/construct/${construct.contractId}`}
        >
            <div className="content-area">
                <div className="grid grid-cols-2 gap-8 items-start max-lg:grid-cols-1 max-lg:gap-6 max-md:gap-4">
                    {/* Left Column: Card + Player Status + Attack Form */}
                    <div className="flex flex-col gap-5">
                        <ConstructCard construct={construct}/>

                        {/* Player Status Panel — only when wallet connected */}
                        {userAccountId && (
                            <PlayerStatusPanel
                                construct={construct}
                                userAccountId={userAccountId}
                                stats={playerStats}
                                loading={playerStatsLoading}
                            />
                        )}

                        {/* Attack Form Section */}
                        {!construct.isDefeated && construct.isActive && (
                            <div>
                                <AttackForm
                                    construct={construct}
                                    cooldownStatus={cooldownStatus ?? undefined}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right Column: Attack History */}
                    <div className="sticky top-8 max-lg:static">
                        <AttackHistory
                            contractId={construct.contractId}
                            xpTokenId={construct.xpTokenId}
                        />
                    </div>
                </div>
            </div>
        </Page>
    );
};

export default ConstructPage;
