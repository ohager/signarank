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
import styles from '@styles/Construct.module.scss';
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
                <div className={styles.constructPage}>
                    <div className={styles.loadingContainer}>
                        Loading construct data...
                    </div>
                </div>
            </Page>
        );
    }

    if (error || !construct) {
        return (
            <Page title="Construct Not Found - SIGNArank">
                <div className={styles.constructPage}>
                    <div className={styles.errorContainer}>
                        <h2>Failed to load construct</h2>
                        <p>{error || 'Construct not found'}</p>
                        <Link href="/">
                            <a>Return to Home</a>
                        </Link>
                    </div>
                </div>
            </Page>
        );
    }

    return (
        <Page title={`${construct.name} - SIGNArank`}>
            <div className={`${styles.constructPage} content`}>
                <div className={styles.twoColumnLayout}>
                    {/* Left Column: Card + Attack Form */}
                    <div className={styles.leftColumn}>
                        <ConstructCard construct={construct} />

                        {/* Attack Form Section */}
                        {!construct.isDefeated && construct.isActive && (
                            <div className={styles.attackSection}>
                                <AttackForm
                                    construct={construct}
                                    cooldownStatus={cooldownStatus ?? undefined}
                                />
                            </div>
                        )}
                    </div>

                    {/* Right Column: Attack History */}
                    <div className={styles.rightColumn}>
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
