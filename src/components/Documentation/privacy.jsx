function Privacy(props) {
    return (
        <>
            <div class='privacy-container'>
                <h1>Privacy Policy</h1>
                <p>Last Updated: November 2026</p>

                <section>
                    <h2>1. Data We Collect</h2>
                    <p>Because we are a No-KYC site, we collect minimal data. We collect your Email Address, Username, IP address, and crypto wallet transaction hashes for the purpose of account security and fraud prevention.</p>
                </section>

                <section>
                    <h2>2. How We Use Data</h2>
                    <p>Your data is used solely to operate the platform, process deposits/withdrawals, and provide customer support. We do not sell your data to third parties.</p>
                </section>

                <section>
                    <h2>3. Crypto Transactions</h2>
                    <p>Blockchain transactions are inherently public. When you submit a deposit or withdrawal, your transaction hash may be linked to your account on our site. We do not link your wallet address to real-world identities.</p>
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

export default Privacy;
