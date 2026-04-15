import {useRouter} from 'next/router';
import Link from 'next/link';
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

export interface ConstructPageBodyProps {
    initialContractId?: string;
}

const ConstructPageBody = ({initialContractId}: ConstructPageBodyProps) => {
    const router = useRouter();
    const contractId = singleQueryString(router.query.contractId) || initialContractId || '';
    const connectedAccount = useAppSelector(selectConnectedAccount);
    const {construct, loading, error} = useConstruct(contractId || null);

    let userAccountId: string | null = null;
    if (connectedAccount) {
        try {
            userAccountId = Address.fromPublicKey(connectedAccount).getNumericId();
        } catch {
            // Invalid public key
        }
    }

    const cooldownStatus = useUserCooldown(
        contractId || null,
        userAccountId,
        construct?.coolDownInBlocks ?? 0
    );

    const {stats: playerStats, loading: playerStatsLoading} = usePlayerConstructStats({
        contractId: contractId || null,
        userAccountId,
        hpTokenId: construct?.hpTokenId ?? null,
        xpTokenId: construct?.xpTokenId ?? null,
        debuffDamageReduction: construct?.debuffDamageReduction ?? 0,
        debuffMaxStack: construct?.debuffMaxStack ?? 0,
    });

    if (loading) {
        return (
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
        );
    }

    if (error || !construct) {
        return (
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
        );
    }

    return (
        <div className="content-area">
            <div className="grid grid-cols-2 gap-8 items-start max-lg:grid-cols-1 max-lg:gap-6 max-md:gap-4">
                {/* Left Column: Card + Player Status + Attack Form */}
                <div className="flex flex-col gap-5">
                    <ConstructCard construct={construct}/>

                    {userAccountId && (
                        <PlayerStatusPanel
                            construct={construct}
                            userAccountId={userAccountId}
                            stats={playerStats}
                            loading={playerStatsLoading}
                        />
                    )}

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
    );
};

export default ConstructPageBody;
