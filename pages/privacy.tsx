import Link from 'next/link';
import Page from '../components/Page';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="mb-8">
        <h2
            className="text-[0.75rem] uppercase tracking-[0.18em] text-[var(--gold)] mb-3 pb-2 border-b border-[var(--glass-border)]"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
            {title}
        </h2>
        <div
            className="text-[var(--text-dim)] text-[0.9rem] leading-relaxed space-y-3"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
        >
            {children}
        </div>
    </section>
);

const Privacy = () => {
    return (
        <Page title="SIGNArank — Privacy Policy">
            <div className="content-area max-w-[780px] mx-auto">
                <div className="glass-static p-8 max-md:p-5">
                    {/* Header */}
                    <div className="mb-10 pb-6 border-b border-[var(--glass-border)]">
                        <h1
                            className="text-2xl font-bold tracking-[0.06em] uppercase mb-2 text-[var(--text)]"
                            style={{ fontFamily: "'Cinzel', serif" }}
                        >
                            Privacy Policy
                        </h1>
                        <p
                            className="text-[0.7rem] text-[var(--text-faint)] tracking-[0.08em]"
                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                            Last updated: April 2026
                        </p>
                    </div>

                    <Section title="1. Overview">
                        <p>
                            SIGNArank is a hobby project operated by ohager, a private individual.
                            This policy explains what information this Platform handles and — more
                            importantly — what it does <em>not</em> collect.
                        </p>
                        <p>
                            The short version: <strong className="text-[var(--text)]">we do not collect,
                            store, or share any personal information about you.</strong> No accounts.
                            No sign-ups. No tracking.
                        </p>
                    </Section>

                    <Section title="2. Your Wallet & Private Keys">
                        <p>
                            SIGNArank interacts with the Signum blockchain exclusively through your
                            browser wallet extension (e.g. XT Wallet). Your private key and seed phrase
                            never leave your wallet — they are <strong className="text-[var(--text)]">never
                            requested, transmitted to, or accessible by this Platform</strong> in any way.
                        </p>
                        <p>
                            All transaction signing happens entirely within your wallet extension. The
                            Platform only receives the signed transaction result after you explicitly
                            approve it. You remain in full control of your keys at all times.
                        </p>
                    </Section>

                    <Section title="3. Public Blockchain Data">
                        <p>
                            Signum is a public blockchain. Wallet addresses, transaction history, token
                            balances, and smart contract interactions are publicly visible to anyone on the
                            network by design. SIGNArank reads this public data to compute scores, ranks,
                            and game state.
                        </p>
                        <p>
                            If you connect your wallet and interact with the game, your Signum address may
                            appear in leaderboards or battle logs. This is inherent to how public blockchains
                            work and does not constitute the collection of personal data on our part.
                        </p>
                    </Section>

                    <Section title="4. Information We Do Not Collect">
                        <p>The following are explicitly <strong className="text-[var(--text)]">not</strong> collected:</p>
                        <ul className="list-none space-y-1.5 mt-2">
                            {[
                                'Names, email addresses, or any contact information',
                                'Passwords or authentication credentials of any kind',
                                'Private keys, seed phrases, or wallet secrets',
                                'Payment or financial information beyond public blockchain activity',
                                'Device identifiers or persistent tracking cookies',
                                'Location data',
                            ].map(item => (
                                <li key={item} className="flex gap-2 items-start">
                                    <span className="text-[var(--gold)] mt-0.5 shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem' }}>—</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="5. Server & Hosting Logs">
                        <p>
                            Like any website, the hosting infrastructure may automatically record standard
                            server logs — such as IP addresses, request timestamps, and browser type — for
                            operational and security purposes. These logs are handled by the hosting provider
                            (Vercel) under their own privacy policy and are not used by the operator to
                            identify or track individuals.
                        </p>
                        <p>
                            No analytics platform, ad network, or third-party tracking script is embedded
                            in this Platform.
                        </p>
                    </Section>

                    <Section title="6. Third-Party Links">
                        <p>
                            The Platform may link to external sites such as the Signum blockchain explorer,
                            community channels, or other resources. These third-party sites have their own
                            privacy policies and are not covered by this document. Visit them at your
                            own discretion.
                        </p>
                    </Section>

                    <Section title="7. Children">
                        <p>
                            This Platform is not intended for use by anyone under the age of 18. It involves
                            real cryptocurrency and is designed for adults who understand the associated
                            risks. If you are under 18, please do not use this Platform.
                        </p>
                    </Section>

                    <Section title="8. Changes to This Policy">
                        <p>
                            If this policy changes in a meaningful way, the "Last updated" date at the top
                            will be revised. Since no personal data is collected, changes are unlikely to
                            affect your privacy in practice.
                        </p>
                    </Section>

                    <Section title="9. Contact">
                        <p>
                            Questions about this policy? Reach out via the Discord or Telegram community
                            links on the Platform, or contact the operator through Signum community channels.
                        </p>
                    </Section>
                </div>
            </div>
        </Page>
    );
};

export default Privacy;
