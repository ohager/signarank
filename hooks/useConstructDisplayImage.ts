import { useEffect, useState } from 'react';
import { ConstructData } from '@lib/construct/types';
import { resolveDamageVariantUrl, resolveDisplayUrl } from '@lib/construct/damageVariants';

export function useConstructDisplayImage(construct: ConstructData | null) {
    const fallback = construct?.imageUrl ?? '';
    const [displayImageUrl, setDisplayImageUrl] = useState(fallback);

    useEffect(() => {
        if (!construct) return;
        const variantUrl = resolveDamageVariantUrl(
            construct.ipfsCid,
            construct.isDefeated,
            construct.currentHp,
            construct.maxHp,
        );

        if (!variantUrl) {
            setDisplayImageUrl(construct.imageUrl);
            return;
        }
        let cancelled = false;
        resolveDisplayUrl(variantUrl, construct.imageUrl).then(url => {
            if (!cancelled) setDisplayImageUrl(url);
        });
        return () => {
            cancelled = true;
        };
    }, [
        construct?.ipfsCid,
        construct?.isDefeated,
        construct?.currentHp,
        construct?.maxHp,
        construct?.imageUrl,
    ]);

    return {
        displayImageUrl,
        handleImageError: () => setDisplayImageUrl(fallback),
    };
}
