import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSeasonInfo } from '@hooks/useSeasonInfo';
import { useConstruct } from '@hooks/useConstruct';
import { getActiveConstructId } from '@lib/construct/constants';

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
        <div className="absolute mt-[15px] max-w-[450px] px-[15px] py-[10px] bg-[linear-gradient(135deg,rgba(0,153,255,0.1),rgba(0,255,136,0.1))] border border-[rgba(0,255,136,0.3)] rounded-md backdrop-blur-[10px] shadow-[0_4px_20px_rgba(0,255,136,0.2)] animate-[pulse-glow_3s_ease-in-out_infinite] text-left flex items-center gap-3 max-md:hidden">
            {!loading && construct && construct.imageUrl && (
                <Link href={`/construct/${construct.contractId}`} className="shrink-0 w-[50px] h-[50px] rounded-full overflow-hidden border-2 border-[rgba(0,255,136,0.4)] transition-[transform,border-color] duration-200 hover:scale-110 hover:border-[rgba(0,255,136,0.8)]">
                    <img
                        src={construct.imageUrl}
                        alt={construct.name}
                        title={`Fight ${construct.name}`}
                        className="w-full h-full object-cover"
                    />
                </Link>
            )}
            <div className="flex-1 min-w-0">
                <span className="block text-[10px] uppercase tracking-[2px] text-[var(--main-color2)] mb-[5px] font-semibold">{name}</span>
                <p className="m-0 text-[13px] leading-[1.4] text-white/90 italic">{description}</p>
            </div>
        </div>
    );
};
