import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSeasonInfo } from '@hooks/useSeasonInfo';
import { useConstruct } from '@hooks/useConstruct';
import { getActiveConstructId } from '@lib/construct/constants';
import styles from '@styles/Header.module.scss';

export const SeasonBanner: React.FC = () => {
    const router = useRouter();
    const { name, isCurrent, description } = useSeasonInfo();
    const activeConstructId = getActiveConstructId();
    // Use fallback ID for development if no env var is set
    const constructId = activeConstructId || '12345678901234567890';
    const { construct, loading } = useConstruct(constructId);

    // Hide banner on season and construct pages
    const isSeasonPage = router.pathname === '/season';
    const isConstructPage = router.pathname.startsWith('/construct/');
    const shouldHide = isSeasonPage || isConstructPage;

    if (!isCurrent || !description || shouldHide) {
        return null;
    }

    return (
        <div className={styles.seasonBanner}>
            {!loading && construct && construct.imageUrl && (
                <Link href={`/construct/${construct.contractId}`}>
                    <a className={styles.constructAvatar}>
                        <img
                            src={construct.imageUrl}
                            alt={construct.name}
                            title={`Fight ${construct.name}`}
                        />
                    </a>
                </Link>
            )}
            <div className={styles.seasonContent}>
                <span className={styles.seasonName}>{name}</span>
                <p className={styles.seasonDescription}>{description}</p>
            </div>
        </div>
    );
};
