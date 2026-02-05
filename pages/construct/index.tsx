import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getActiveConstructId } from '@lib/construct/constants';
import Page from '@components/Page';
import styles from '@styles/Construct.module.scss';

const ConstructIndexPage = () => {
    const router = useRouter();
    const activeContractId = getActiveConstructId();

    useEffect(() => {
        if (activeContractId) {
            router.replace(`/construct/${activeContractId}`);
        }
    }, [activeContractId, router]);

    if (!activeContractId) {
        return (
            <Page title="No Active Construct - SIGNArank">
                <div className={styles.constructPage}>
                    <div className={styles.errorContainer}>
                        <h2>No Active Construct</h2>
                        <p>No construct is currently configured.</p>
                    </div>
                </div>
            </Page>
        );
    }

    return (
        <Page title="Redirecting... - SIGNArank">
            <div className={styles.constructPage}>
                <div className={styles.loadingContainer}>
                    Redirecting to active construct...
                </div>
            </div>
        </Page>
    );
};

export default ConstructIndexPage;
