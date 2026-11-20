"use client";
import styles from "./FAQsSection.module.css";
const faqs=[
 {question:"What is GalaxyBets?",answer:"GalaxyBets offers online case openings, case battles and house games. Case rewards are virtual items held in your site inventory."},
 {question:"Can I have items delivered?",answer:"GalaxyBets is virtual-only for now. Physical item delivery is planned to launch soon, but shipping is not currently available and no launch date is confirmed. We will announce availability and delivery terms before orders open."},
 {question:"How do I deposit?",answer:"Open your wallet, choose Deposit and select a supported cryptocurrency. Use the exact address and network shown. The minimum deposit is $5. Follow the deposit instructions and keep your transaction ID."},
 {question:"How do withdrawals work?",answer:"You can request a withdrawal from your available balance. The minimum withdrawal is $15. Ordinary deposits require 1× qualifying wagering. New streamer bonus deposits require 5× (deposit + bonus), replacing the normal 1× for that deposit. Previously accepted bonuses keep their original terms. Check the wallet for your remaining requirement. Requests are reviewed before payment."},
 {question:"What if my crypto deposit is missing?",answer:"Check the destination address, selected network and transaction status. If it has not appeared after confirmation and review, contact support with your transaction ID, coin, network and amount. Never share passwords or private keys."},
 {question:"How do I open a case?",answer:"Choose a case and review its price, rewards and displayed odds. Select your quantity and open it using your site balance. Rewards appear in your cart, where eligible items can be sold for balance."},
 {question:"What are battles?",answer:"Players open the selected cases together. The battle mode determines how the rewards are distributed. Review the mode, entry cost, funding and any affiliate-code restrictions before joining."},
 {question:"How do I contact support?",answer:"Email GalaxyBets support using the link below. Include your username and a description of the issue.",support:true}
];
export default function FAQsSection(){return <section className={styles.section} aria-label="Frequently asked questions"><h2>FAQs</h2><div className={styles.grid}>{faqs.map(faq=><details key={faq.question} className={styles.item}><summary>{faq.question}</summary><p>{faq.answer}{faq.support&&<> <a href="mailto:support@galaxybets.casino">support@galaxybets.casino</a></>}</p></details>)}</div></section>}
