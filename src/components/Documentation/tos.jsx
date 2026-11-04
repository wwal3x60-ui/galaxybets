function TOS(props) {
    return (
        <>
            <div class='tos-container'>
                <h1>GalaxyBets Terms of Service</h1>
                <p>Last Updated: November 2026</p>

                <section>
                    <h2>1. Acceptance of Terms</h2>
                    <p>By accessing or using GalaxyBets, you agree to be bound by these Terms. If you do not agree, you must leave the site immediately.</p>
                </section>

                <section>
                    <h2>2. Eligibility</h2>
                    <p>You must be at least 18 years old (or the legal gambling age in your jurisdiction) to use this site. It is your responsibility to ensure that online gambling is legal in your country. We reserve the right to block access from restricted jurisdictions.</p>
                </section>

                <section>
                    <h2>3. No-KYC Policy</h2>
                    <p>GalaxyBets operates on a No-KYC (Know Your Customer) basis for standard gameplay. However, we reserve the right to request proof of identity or source of funds at any time if we suspect fraudulent activity, money laundering, or abuse of our system.</p>
                </section>

                <section>
                    <h2>4. Cryptocurrency &amp; Wagers</h2>
                    <p>All deposits, wagers, and withdrawals are conducted in supported cryptocurrencies (e.g., SOL, USDT). We are not responsible for price volatility. Once a deposit is approved, the fiat equivalent is credited at our locked rate.</p>
                </section>

                <section>
                    <h2>5. Account Termination</h2>
                    <p>We reserve the right to suspend or terminate your account, void bets, and confiscate balances if we detect cheating, multi-accounting, exploiting bugs, or fraudulent crypto transactions.</p>
                </section>
            </div>

            <style jsx>{`
                .tos-container {
                    width: 100%;
                    max-width: 1175px;
                    box-sizing: border-box;
                    padding: 30px 0;
                    margin: 0 auto;
                    color: #ADA3EF;
                    font-family: "Geogrotesque Wide", sans-serif;
                    font-size: 13px;
                    font-weight: 400;
                    display: flex;
                    flex-direction: column;
                    gap: 25px;
                }

                h1 {
                    color: #FFF;
                    font-size: 24px;
                    margin: 0;
                }

                h2 {
                    color: #FFF;
                    font-size: 18px;
                    font-weight: 700;
                    margin: 0 0 10px;
                }

                p {
                    margin: 0;
                    line-height: 1.6;
                }

                section {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
            `}</style>
        </>
    );
}

export default TOS;
