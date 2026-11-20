'use client';
import {formatWalletBalance} from '@/lib/utils/wallet-display';
import styles from './BalanceCapsule.module.css';
interface Props {balance:unknown;onWallet:()=>void;onDeposit:()=>void;compact?:boolean;}
export default function BalanceCapsule({balance,onWallet,onDeposit,compact=false}:Props){
 const amount=formatWalletBalance(balance);
 return <div className={`${styles.capsule} ${compact?styles.compact:''}`}>
  <button type="button" className={styles.wallet} onClick={onWallet} aria-label={`Wallet balance ${amount}. Open wallet.`}>
   <span className={styles.coin} aria-hidden="true">$</span>
   <span className={styles.details}><span className={styles.label}>BALANCE <span>USD</span></span><span className={styles.amount} aria-live="polite" aria-atomic="true">{amount}</span></span>
   <svg className={styles.chevron} width="10" height="10" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
  </button>
  <button type="button" className={styles.deposit} onClick={onDeposit} aria-label="Deposit funds" title="Deposit funds"><svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg><span className={styles.depositText}>Deposit</span></button>
 </div>;
}
