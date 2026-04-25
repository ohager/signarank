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

const Terms = () => {
    return (
        <Page title="SIGNArank — Terms of Use">
            <div className="content-area max-w-[780px] mx-auto">
                <div className="glass-static p-8 max-md:p-5">
                    {/* Header */}
                    <div className="mb-10 pb-6 border-b border-[var(--glass-border)]">
                        <h1
                            className="text-2xl font-bold tracking-[0.06em] uppercase mb-2 text-[var(--text)]"
                            style={{ fontFamily: "'Cinzel', serif" }}
                        >
                            Terms of Use
                        </h1>
                        <p
                            className="text-[0.7rem] text-[var(--text-faint)] tracking-[0.08em]"
                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                            Last updated: April 2026
                        </p>
                    </div>

                    <Section title="1. About This Platform">
                        <p>
                            SIGNArank is a hobby project operated by ohager, a private individual
                            ("the operator", "I", "me"). It is not operated by or affiliated with any company,
                            corporation, or commercial entity.
                        </p>
                        <p>
                            By accessing or using SIGNArank (the "Platform"), you confirm that you have read,
                            understood, and agree to these Terms of Use ("Terms"). If you do not agree, please
                            leave the Platform immediately. These Terms should be read alongside
                            the <Link href="/privacy" className="text-[var(--gold)] underline underline-offset-2">Privacy Policy</Link>.
                        </p>
                        <p>
                            I may update these Terms from time to time. Continued use of the Platform after
                            changes are posted constitutes your acceptance of the revised Terms.
                        </p>
                    </Section>

                    <Section title="2. Nature of the Platform">
                        <p>
                            SIGNArank is a blockchain-based achievement system built on the Signum network. It involves
                            interacting with smart contracts using SIGNA, the native cryptocurrency of the
                            Signum blockchain. The Platform is provided purely for entertainment and
                            educational purposes.
                        </p>
                        <p>
                            The game mechanics include sending SIGNA to smart contracts as part of gameplay
                            ("attacks"). A portion of accumulated contract balances (up to 5%) may flow to
                            a treasury address maintained by the operator to cover infrastructure and
                            development costs. This is not a financial product, investment vehicle, or
                            gambling service.
                        </p>
                    </Section>

                    <Section title="3. Blockchain & Financial Disclaimer">
                        <p>
                            <strong className="text-[var(--text)]">Transactions are irreversible.</strong> All
                            interactions with the Signum blockchain — including sending SIGNA to game
                            contracts — are final and cannot be undone. I have no ability to reverse, refund,
                            or modify on-chain transactions.
                        </p>
                        <p>
                            <strong className="text-[var(--text)]">SIGNA has real monetary value.</strong> You
                            are responsible for understanding that any SIGNA you send during gameplay has
                            real-world value. Only participate with amounts you are comfortable losing
                            entirely. Nothing on this Platform constitutes financial, investment, or
                            legal advice.
                        </p>
                        <p>
                            <strong className="text-[var(--text)]">Smart contracts may contain bugs.</strong> While
                            smart contracts are deployed in good faith, they may contain errors or
                            vulnerabilities. I make no guarantee that contracts will behave exactly as
                            described or that funds will be recoverable in the event of a bug.
                        </p>
                        <p>
                            <strong className="text-[var(--text)]">No guarantee of rewards.</strong> Any
                            in-game rewards, tokens, or NFTs are subject to smart contract logic and
                            blockchain conditions. I do not guarantee the availability, value, or
                            distribution of any reward.
                        </p>
                    </Section>

                    <Section title="4. Eligibility & Use">
                        <p>
                            You must be at least 18 years of age to use this Platform. By using it, you
                            confirm that you meet this requirement and that your use complies with all
                            laws applicable in your jurisdiction.
                        </p>
                        <p>
                            You are solely responsible for securing your wallet credentials and private
                            keys. I will never ask for your private key or seed phrase.
                        </p>
                    </Section>

                    <Section title="5. Prohibited Uses">
                        <p>You agree not to use the Platform in any way that:</p>
                        <ul className="list-none space-y-1.5 mt-2">
                            {[
                                'is unlawful, illegal, or unauthorized in your jurisdiction;',
                                'attempts to exploit, manipulate, or interfere with smart contracts or game mechanics in bad faith;',
                                'involves the use of bots, scripts, or automated tools to gain unfair advantage;',
                                'defames, harasses, or harms other users;',
                                'infringes on any third-party intellectual property rights;',
                                'promotes discrimination or illegal activity of any kind.',
                            ].map(item => (
                                <li key={item} className="flex gap-2 items-start">
                                    <span className="text-[var(--gold)] mt-0.5 shrink-0" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem' }}>—</span>
                                    <span>{item}</span>
                                </li>
                            ))}
                        </ul>
                    </Section>

                    <Section title="6. Intellectual Property">
                        <p>
                            The SIGNArank name, logo, visual design, and original content are the creative
                            work of the operator. You may not copy, reproduce, or redistribute them without
                            prior written permission.
                        </p>
                        <p>
                            Third-party trademarks, assets, and brand names referenced on this Platform
                            remain the property of their respective owners.
                        </p>
                    </Section>

                    <Section title="7. No Warranties">
                        <p>
                            The Platform is provided on an "as is" and "as available" basis. I make no
                            representations or warranties of any kind, express or implied, including but not
                            limited to warranties of merchantability, fitness for a particular purpose, or
                            non-infringement.
                        </p>
                        <p>
                            I do not warrant that the Platform will be uninterrupted, error-free, or free of
                            harmful components, or that blockchain data displayed is always accurate or
                            up to date.
                        </p>
                    </Section>

                    <Section title="8. Limitation of Liability">
                        <p>
                            To the fullest extent permitted by applicable law, I shall not be liable for any
                            direct, indirect, incidental, special, or consequential damages arising from your
                            use of the Platform — including but not limited to loss of SIGNA, loss of
                            in-game assets, wallet compromise, smart contract failure, or reliance on
                            inaccurate data.
                        </p>
                        <p>
                            You use this Platform entirely at your own risk.
                        </p>
                    </Section>

                    <Section title="9. Governing Law">
                        <p>
                            These Terms are governed by the laws of the Federal Republic of Brazil.
                            Any disputes arising in connection with these Terms shall be subject to the
                            exclusive jurisdiction of the courts of the operator's place of residence.
                        </p>
                        <p>
                            If any provision of these Terms is found to be invalid or unenforceable, the
                            remaining provisions will continue in full force and effect.
                        </p>
                    </Section>

                    <Section title="10. Contact">
                        <p>
                            For questions about these Terms, reach out via the Discord or Telegram community
                            links listed on the Platform, or contact me directly through the Signum
                            community channels.
                        </p>
                    </Section>
                </div>
            </div>
        </Page>
    );
};

export default Terms;
