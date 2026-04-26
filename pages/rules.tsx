import React, { useMemo } from 'react';
import Link from 'next/link';
import Page from '@components/Page';
import { useTokenMeta } from '@hooks/useTokenMeta';
import {getAttackTokenIds, getSignumSwapUrl} from '@lib/construct/constants';

const getTokenAcquisitionUrl = (tokenId: string) => {
    return getSignumSwapUrl() + '/tokens/' + tokenId
}


const Section: React.FC<{ title: string; children: React.ReactNode }> = ({title, children}) => (
    <div className="glass-static p-7 max-md:p-5">
        <h2
            className="text-[1.05rem] font-bold tracking-[0.1em] uppercase mb-5 pb-3 border-b border-[var(--glass-border)] text-[var(--gold)]"
            style={{fontFamily: "'Cinzel', serif"}}
        >
            {title}
        </h2>
        <div
            className="text-[var(--text-dim)] leading-relaxed space-y-3"
            style={{fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem'}}
        >
            {children}
        </div>
    </div>
);

const TraitBadge: React.FC<{ label: string }> = ({label}) => (
    <span
        className="inline-block text-[0.6rem] font-semibold uppercase tracking-[0.08em] py-0.5 px-2 rounded-sm"
        style={{
            fontFamily: "'IBM Plex Mono', monospace",
            color: 'var(--gold)',
            background: 'rgba(197,164,78,0.08)',
            border: '1px solid rgba(197,164,78,0.2)',
        }}
    >
        {label}
    </span>
);

const ExternalLink: React.FC<{ href: string; children: React.ReactNode }> = ({href, children}) => (
    <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--gold)] hover:text-[var(--gold-bright)] transition-colors underline underline-offset-2 decoration-[rgba(197,164,78,0.4)]"
    >
        {children}
    </a>
);

const AttackTokensSection = () => {
    const attackTokenIds = useMemo(() => getAttackTokenIds(), []);
    const { tokens, loading } = useTokenMeta(attackTokenIds);

    if (attackTokenIds.length === 0) return null;

    return (
        <Section title="Attack Tokens">
            <p>
                Attack Tokens are optional power-ups you can include with your attack to deal bonus damage
                beyond the base SIGNA rate. Each token type has a specific multiplier or addition configured
                directly in the Construct&apos;s smart contract. Keep in mind that a Construct reacts differently to each token type.
            </p>
            <div className="mt-4 flex flex-col gap-3">
                {loading ? (
                    Array.from({ length: attackTokenIds.length }).map((_, i) => (
                        <div
                            key={i}
                            className="h-14 rounded-sm"
                            style={{
                                background: 'linear-gradient(90deg, rgba(197,164,78,0.04) 25%, rgba(197,164,78,0.09) 50%, rgba(197,164,78,0.04) 75%)',
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 1.5s infinite',
                            }}
                        />
                    ))
                ) : (
                    tokens.map(token => (
                        <div
                            key={token.tokenId}
                            className="flex items-center gap-4 py-3 px-4 rounded-sm"
                            style={{
                                background: 'rgba(197,164,78,0.03)',
                                border: '1px solid rgba(197,164,78,0.12)',
                            }}
                        >
                            {token.iconUrl ? (
                                <img
                                    src={token.iconUrl}
                                    alt={token.name}
                                    className="w-9 h-9 rounded-full shrink-0"
                                    style={{ background: 'rgba(255,255,255,0.06)' }}
                                />
                            ) : (
                                <div
                                    className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
                                    style={{ background: 'rgba(197,164,78,0.08)' }}
                                >
                                    <span style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', fontSize: '0.85rem' }}>
                                        {token.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                        className="text-[var(--text)] text-[0.95rem] font-semibold"
                                        style={{ fontFamily: "'Cinzel', serif" }}
                                    >
                                        {token.name}
                                    </span>
                                    {token.symbol && (
                                        <span
                                            className="text-[0.6rem] uppercase tracking-[0.08em] py-0.5 px-2 rounded-sm"
                                            style={{
                                                fontFamily: "'IBM Plex Mono', monospace",
                                                color: 'var(--gold)',
                                                background: 'rgba(197,164,78,0.08)',
                                                border: '1px solid rgba(197,164,78,0.2)',
                                            }}
                                        >
                                            {token.symbol}
                                        </span>
                                    )}
                                </div>
                                {token.description && (
                                    <p className="m-0 mt-0.5 text-[0.85rem] text-[var(--text-dim)]">
                                        {token.description}
                                    </p>
                                )}
                            </div>
                            <a
                                href={getTokenAcquisitionUrl(token.tokenId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 py-1.5 px-3 rounded-sm text-[0.65rem] uppercase tracking-[0.1em] transition-all duration-200 hover:brightness-110"
                                style={{
                                    fontFamily: "'Cinzel', serif",
                                    background: 'rgba(197,164,78,0.08)',
                                    border: '1px solid rgba(197,164,78,0.25)',
                                    color: 'var(--gold)',
                                }}
                            >
                                Acquire
                            </a>
                        </div>
                    ))
                )}
            </div>
        </Section>
    );
};

const RulesPage = () => (
    <Page title="Rules - SIGNArank" description="How SIGNArank works: attack mechanics, construct behavior, traits, rewards, and ranking.">
        <div className="content-area max-w-[860px] mx-auto">
            {/* Header */}
            <div className="text-center mb-10">
                <h1
                    className="text-[clamp(1.8rem,4vw,2.6rem)] font-bold tracking-[0.06em] uppercase mb-3"
                    style={{fontFamily: "'Cinzel', serif"}}
                >
                    <span
                        style={{
                            background: 'linear-gradient(90deg, var(--text) 0%, var(--gold-bright) 40%, var(--text) 100%)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                        }}
                    >
                        Game Rules
                    </span>
                </h1>
                <p
                    className="text-lg text-[var(--text-dim)] max-w-[540px] mx-auto leading-relaxed"
                    style={{fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic'}}
                >
                    SIGNArank runs entirely on Signum Smart Contracts — no servers, no admins, no trust required.
                    Every attack, every reward, every record is settled on-chain.
                </p>
            </div>

            <div className="flex flex-col gap-6">

                {/* On-Chain Foundation */}
                <Section title="On-Chain & Decentralized">
                    <p>
                        Each Construct is a <strong className="text-[var(--text)]">Signum Smart Contract</strong> deployed on the
                        Signum blockchain. All game logic — damage calculation, reward distribution, debuff tracking,
                        regeneration — is executed by the contract itself. There is no central server involved.
                    </p>
                    <p>
                        When you attack, you send a transaction directly to the contract. The contract computes
                        the outcome and updates everything atomically. Results are permanent and publicly verifiable
                        on the Signum blockchain explorer.
                    </p>
                </Section>

                {/* Attack Mechanics */}
                <Section title="How to Attack">
                    <p>
                        To attack a Construct, connect your Signum wallet and send SIGNA to the contract via the
                        attack form on the Construct&apos;s page.
                    </p>
                    <ul className="list-none flex flex-col gap-3 mt-1">
                        <li className="flex gap-3 items-start">
                            <span className="text-[var(--gold)] mt-0.5 shrink-0">▸</span>
                            <span>
                                <strong className="text-[var(--text)]">Damage rate</strong> — every{' '}
                                <strong className="text-[var(--text)]">10 SIGNA</strong> you send deals{' '}
                                <strong className="text-[var(--text)]">1 HP</strong> of damage to the Construct.
                            </span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <span className="text-[var(--gold)] mt-0.5 shrink-0">▸</span>
                            <span>
                                <strong className="text-[var(--text)]">Activation fee</strong> — each attack requires
                                a fixed <strong className="text-[var(--text)]">2 SIGNA</strong> activation fee paid
                                to the contract, on top of your chosen attack amount.
                            </span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <span className="text-[var(--gold)] mt-0.5 shrink-0">▸</span>
                            <span>
                                <strong className="text-[var(--text)]">Attack Tokens</strong> (optional) — special
                                tokens that can amplify your damage beyond the base rate. Attack Tokens can be
                                acquired on{' '}
                                <ExternalLink href="https://signumswap.com">SignumSwap</ExternalLink>,
                                the Signum Token DeFi platform.
                            </span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <span className="text-[var(--gold)] mt-0.5 shrink-0">▸</span>
                            <span>
                                <strong className="text-[var(--text)]">Cooldown</strong> — after each attack you must
                                wait a number of Signum blocks (~4 minutes per block) before attacking the same
                                Construct again. The cooldown is fixed per Construct and shown on its page.
                            </span>
                        </li>
                    </ul>
                    <p className="pt-1">
                        <strong className="text-[var(--text)]">First Blood</strong> is awarded to the very first
                        attacker of a Construct. <strong className="text-[var(--text)]">Final Blow</strong> goes to
                        whoever reduces HP to zero. Both are recorded permanently in the contract.
                    </p>
                </Section>

                {/* Attack Tokens */}
                <AttackTokensSection />

                {/* Construct Behavior */}
                <Section title="Construct Behavior">
                    <p>
                        Constructs are not passive targets. Depending on their configuration they can fight back
                        or recover between attacks:
                    </p>
                    <ul className="list-none flex flex-col gap-3 mt-1">
                        <li className="flex gap-3 items-start">
                            <span className="text-[var(--gold)] mt-0.5 shrink-0">▸</span>
                            <span>
                                <strong className="text-[var(--text)]">Regeneration</strong> — some Constructs
                                heal themselves automatically over time. Sustained attacks from the community are
                                necessary to outpace the healing. Flagged with <TraitBadge label="↺ Regenerates" />.
                            </span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <span className="text-[var(--gold)] mt-0.5 shrink-0">▸</span>
                            <span>
                                <strong className="text-[var(--text)]">Breach Limit</strong> — a cap on how much
                                HP a single attack can remove. This prevents any one attacker from dominating the
                                fight. Constructs with a high breach limit are tagged <TraitBadge label="⬡ Fortified" />.
                            </span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <span className="text-[var(--gold)] mt-0.5 shrink-0">▸</span>
                            <span>
                                <strong className="text-[var(--text)]">Curses</strong> — attacking a{' '}
                                <TraitBadge label="✦ Curses" /> Construct stacks a debuff on you. Each stack
                                reduces the damage your wallet deals. Spread attacks across multiple wallets
                                or pause to let debuffs clear.
                            </span>
                        </li>
                    </ul>
                </Section>

                {/* Traits */}
                <Section title="Construct Traits">
                    <p>
                        Traits are derived from the Construct&apos;s contract configuration and appear as badges
                        on the Construct card.
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                        {[
                            {
                                badge: '☽ Primordial',
                                desc: 'The rarest and most powerful tier. Defeating one demands a sustained community effort.',
                            },
                            {
                                badge: '⬡ Archon',
                                desc: 'A formidable opponent requiring coordinated, sustained attacks to bring down.',
                            },
                            {
                                badge: '◈ Titan',
                                desc: 'Durable and capable of outlasting casual attackers.',
                            },
                            {
                                badge: '⚑ Warlord',
                                desc: 'A seasoned fighter with considerable staying power.',
                            },
                            {
                                badge: '↺ Regenerates',
                                desc: 'Heals HP automatically over time. Consistent community pressure is required to make net progress.',
                            },
                            {
                                badge: '✦ Curses',
                                desc: 'Applies a stacking debuff to attackers, reducing damage per hit. Attack strategically.',
                            },
                            {
                                badge: '◆ Drops NFT',
                                desc: 'Awards a unique NFT to the Final Blow attacker. Only one exists per Construct — viewable on SignuMART.',
                            },
                            {
                                badge: '⬡ Fortified',
                                desc: 'A single attack cannot remove more than a set fraction of the Construct\'s remaining HP.',
                            },
                        ].map(({badge, desc}) => (
                            <div key={badge} className="flex gap-3 items-start">
                                <div className="shrink-0 mt-0.5"><TraitBadge label={badge} /></div>
                                <p className="m-0 text-[0.95rem] text-[var(--text-dim)]">{desc}</p>
                            </div>
                        ))}
                    </div>
                    <p className="pt-2">
                        NFTs earned from Constructs can be viewed and traded on{' '}
                        <ExternalLink href="https://signumart.io">SignumArt</ExternalLink>,
                        the Signum NFT marketplace.
                    </p>
                </Section>

                {/* Reward Distribution */}
                <Section title="Reward Distribution">
                    <p>
                        Every SIGNA sent as an attack contributes to the Construct&apos;s{' '}
                        <strong className="text-[var(--text)]">Reward Pot</strong>. When the Construct is
                        defeated, the pot is split automatically and permanently by the contract:
                    </p>
                    <div className="mt-3 flex flex-col gap-0 overflow-hidden rounded-sm border border-[var(--glass-border)]">
                        {[
                            {pct: '85%', label: 'Players', desc: 'Distributed proportionally to all attackers based on the damage they dealt.', color: '#4ade80'},
                            {pct: '10%', label: 'Burned', desc: 'Permanently removed from circulation — a deflationary, anti-inflation mechanism for SIGNA.', color: 'var(--ember)'},
                            {pct: '5%', label: 'Platform', desc: 'Funds ongoing development and future seasons.', color: 'var(--gold)'},
                        ].map(({pct, label, desc, color}, i) => (
                            <div
                                key={label}
                                className={`flex gap-4 items-start px-5 py-4 max-md:px-4 max-md:py-3 ${i > 0 ? 'border-t border-[var(--glass-border)]' : ''}`}
                            >
                                <span
                                    className="text-[1.3rem] font-bold shrink-0 w-[4rem] text-right leading-none pt-0.5"
                                    style={{fontFamily: "'IBM Plex Mono', monospace", color}}
                                >
                                    {pct}
                                </span>
                                <div>
                                    <span
                                        className="block text-[0.7rem] font-semibold uppercase tracking-[0.12em] mb-0.5"
                                        style={{fontFamily: "'IBM Plex Mono', monospace", color}}
                                    >
                                        {label}
                                    </span>
                                    <span className="text-[0.95rem] text-[var(--text-dim)]">{desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="pt-1">
                        Player rewards are proportional to HP Tokens — tokens issued by the contract to each
                        attacker in proportion to the damage they dealt. More damage dealt means a larger share
                        of the pot.
                    </p>
                    <p>
                        If the Construct has <TraitBadge label="◆ Drops NFT" />, the Final Blow attacker
                        additionally receives a unique NFT minted directly by the contract.
                    </p>
                </Section>

                {/* Ranking Influence */}
                <Section title="Influence on the Overall Ranking">
                    <p>
                        The SIGNArank leaderboard measures your overall on-chain activity through an Achievement
                        system. Construct battles contribute to your rank in several ways:
                    </p>
                    <ul className="list-none flex flex-col gap-2 mt-1">
                        <li className="flex gap-3 items-start">
                            <span className="text-[var(--gold)] mt-0.5 shrink-0">▸</span>
                            <span>
                                <strong className="text-[var(--text)]">XP Tokens</strong> — earned alongside damage
                                tokens when you attack. Accumulated XP contributes to gaming-category achievements
                                and your total score.
                            </span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <span className="text-[var(--gold)] mt-0.5 shrink-0">▸</span>
                            <span>
                                <strong className="text-[var(--text)]">Milestones</strong> — First Blood, Final Blow,
                                and defeating a Construct may unlock specific achievement goals worth bonus points.
                            </span>
                        </li>
                        <li className="flex gap-3 items-start">
                            <span className="text-[var(--gold)] mt-0.5 shrink-0">▸</span>
                            <span>
                                <strong className="text-[var(--text)]">Transaction activity</strong> — every attack
                                is an on-chain transaction, feeding into broader activity-based achievements.
                            </span>
                        </li>
                    </ul>
                    <p className="pt-1">
                        Your rank reflects all Signum activity holistically — construct battles are one pillar
                        among several categories including finance, social, collecting, and technology.
                    </p>
                </Section>

                {/* CTA */}
                <div className="flex gap-4 justify-center flex-wrap pt-2">
                    <Link
                        href="/season"
                        className="py-2.5 px-6 rounded-sm text-[0.75rem] font-semibold uppercase tracking-[0.15em] transition-all duration-200 hover:brightness-110"
                        style={{
                            fontFamily: "'Cinzel', serif",
                            background: 'linear-gradient(135deg, rgba(197,164,78,0.9), rgba(232,200,90,0.9))',
                            color: '#080610',
                        }}
                    >
                        View Season
                    </Link>
                    <Link
                        href="/leaderboard"
                        className="py-2.5 px-6 rounded-sm text-[0.75rem] font-semibold uppercase tracking-[0.15em] transition-all duration-200 hover:text-[var(--gold)]"
                        style={{
                            fontFamily: "'Cinzel', serif",
                            background: 'rgba(197,164,78,0.06)',
                            border: '1px solid rgba(197,164,78,0.25)',
                            color: 'var(--text-dim)',
                        }}
                    >
                        Leaderboard
                    </Link>
                </div>
            </div>
        </div>
    </Page>
);

export default RulesPage;
