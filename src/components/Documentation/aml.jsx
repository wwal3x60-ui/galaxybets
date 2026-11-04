function AML(props) {
    return (
        <>
            <div class='privacy-container'>
                <h1>AML &amp; Fair Play Policy</h1>
                <p>Last Updated: November 2026</p>

                <section>
                    <h2>1. No-KYC Stance</h2>
                    <p>GalaxyBets does not require mandatory KYC for standard users. We believe in privacy and decentralized finance.</p>
                </section>

                <section>
                    <h2>2. Suspicious Activity</h2>
                    <p>Despite our No-KYC stance, we employ automated systems to detect suspicious behavior (e.g., using stolen funds, massive layering through bets, or exploiting odds). If flagged, withdrawals may be paused pending a manual review.</p>
                </section>

                <section>
                    <h2>3. Right to Refuse Service</h2>
                    <p>We reserve the absolute right to refuse service, cancel withdrawals, and lock accounts that we determine, in our sole discretion, to be involved in money laundering, terrorism financing, or any other illegal activity.</p>
                </section>
            </div>

            <style jsx>{`
                .privacy-container {
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

export default AML;
