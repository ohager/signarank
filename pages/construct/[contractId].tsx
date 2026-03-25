import { useRouter } from 'next/router';
import Page from '@components/Page';
import { ConstructCard } from '@components/Construct/ConstructCard';
import { AttackForm } from '@components/Construct/AttackForm';
import { AttackHistory } from '@components/Construct/AttackHistory';
import { useConstruct } from '@hooks/useConstruct';
import { useUserCooldown } from '@hooks/useUserCooldown';
import { useAppSelector } from '@states/hooks';
import { selectConnectedAccount } from '@states/appState';
import { singleQueryString } from '@lib/singleQueryString';
import { Address } from '@signumjs/core';
import Link from 'next/link';

const ConstructPage = () => {
    const router = useRouter();
    const contractId = singleQueryString(router.query.contractId);
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const { construct, loading, error } = useConstruct(contractId || null);

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

    if (loading) {
        return (
            <Page title="Loading Construct - SIGNArank">
                <div className="max-w-[1400px] mx-auto p-8 max-lg:p-6 max-md:p-4">
                    <div className="flex justify-center items-center min-h-[400px] text-white text-xl">
                        Loading construct data...
                    </div>
                </div>
            </Page>
        );
    }

    if (error || !construct) {
        return (
            <Page title="Construct Not Found - SIGNArank">
                <div className="max-w-[1400px] mx-auto p-8 max-lg:p-6 max-md:p-4">
                    <div className="flex flex-col justify-center items-center min-h-[400px] text-red-500 text-center gap-4">
                        <h2>Failed to load construct</h2>
                        <p>{error || 'Construct not found'}</p>
                        <Link href="/">
                            Return to Home
                        </Link>
                    </div>
                </div>
            </Page>
        );
    }

    return (
        <Page title={`${construct.name} - SIGNArank`}>
            <div className="max-w-[1400px] mx-auto p-8 max-lg:p-6 max-md:p-4 content">
                <div className="grid grid-cols-2 gap-8 items-start max-lg:grid-cols-1 max-lg:gap-6 max-md:gap-4">
                    {/* Left Column: Card + Attack Form */}
                    <div className="flex flex-col gap-4 max-md:gap-3">
                        <ConstructCard construct={construct} />

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
