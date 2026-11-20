'use client';
import {useCallback,useId,useRef,useState,type KeyboardEvent} from 'react';
import {Modal,ModalContent} from '@heroui/react';
import {useAuthStore} from '@/store/auth.store';
import DepositModal from './DepositModal';
import WithdrawModal from './WithdrawModal';
import CashierTips from './CashierTips';
import styles from './CashierModal.module.css';
type Tab='deposit'|'withdraw'|'tips';
const tabs:Tab[]=['deposit','withdraw','tips'];
const labels={deposit:'Deposit',withdraw:'Withdraw',tips:'Tips'};
const captions={deposit:'Add funds to your GalaxyBets wallet.',withdraw:'Your balance, wagering progress and withdrawals.',tips:'Send a little luck to another player.'};
export default function CashierModal({onClose,initialTab='deposit'}:{onClose:()=>void;initialTab?:Tab}){
 const [tab,setTab]=useState<Tab>(initialTab),[pending,setPending]=useState({deposit:false,withdraw:false,tips:false});
 const busy=Object.values(pending).some(Boolean),id=useId(),buttons=useRef<Array<HTMLButtonElement|null>>([]);
 const user=useAuthStore(s=>s.user);
 const balance=Number(user?.walletBalance??0).toLocaleString('en-US',{style:'currency',currency:'USD'});
 const depositBusy=useCallback((value:boolean)=>setPending(p=>p.deposit===value?p:{...p,deposit:value}),[]);
 const withdrawBusy=useCallback((value:boolean)=>setPending(p=>p.withdraw===value?p:{...p,withdraw:value}),[]);
 const tipsBusy=useCallback((value:boolean)=>setPending(p=>p.tips===value?p:{...p,tips:value}),[]);
 const close=()=>{if(!busy)onClose()};
 function navigate(event:KeyboardEvent<HTMLButtonElement>,index:number){
  if(busy)return;let next=index;
  if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
  event.preventDefault();setTab(tabs[next]);buttons.current[next]?.focus();
 }
 return <Modal isOpen onClose={close} isDismissable={!busy} isKeyboardDismissDisabled={busy} hideCloseButton={busy} size="3xl" placement="center" scrollBehavior="inside" aria-labelledby={`${id}-title`} classNames={{base:styles.modal,backdrop:styles.backdrop,closeButton:styles.close}}>
  <ModalContent className={styles.content}>
   <header className={styles.header}><div><span className={styles.eyebrow}>YOUR GALAXYBETS WALLET</span><h2 id={`${id}-title`}>Cashier<span className={styles.live}>USD</span></h2><p>{captions[tab]}</p></div><div className={styles.balance}><span>Available balance</span><strong>{balance}</strong></div></header>
   <div className={styles.tabs} role="tablist" aria-label="Cashier actions">{tabs.map((value,index)=><button key={value} type="button" ref={el=>{buttons.current[index]=el}} role="tab" id={`${id}-${value}-tab`} aria-controls={`${id}-${value}-panel`} aria-selected={tab===value} tabIndex={tab===value?0:-1} disabled={busy} onKeyDown={event=>navigate(event,index)} onClick={()=>setTab(value)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{value==='deposit'?<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>:value==='withdraw'?<path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5"/>:<><path d="M4 6h16v12H4zM7 12h2m6 0h2"/><circle cx="12" cy="12" r="2"/></>}</svg>{labels[value]}</button>)}</div>
   <div className={styles.panel} id={`${id}-deposit-panel`} role="tabpanel" aria-labelledby={`${id}-deposit-tab`} hidden={tab!=='deposit'}><DepositModal embedded onClose={onClose} onBusyChange={depositBusy}/></div>
   <div className={styles.panel} id={`${id}-withdraw-panel`} role="tabpanel" aria-labelledby={`${id}-withdraw-tab`} hidden={tab!=='withdraw'}><WithdrawModal embedded active={tab==='withdraw'} onClose={onClose} onBusyChange={withdrawBusy}/></div>
   <div className={styles.panel} id={`${id}-tips-panel`} role="tabpanel" aria-labelledby={`${id}-tips-tab`} hidden={tab!=='tips'}><CashierTips onBusyChange={tipsBusy}/></div>
   <footer className={styles.footnote}><span><i/> USD wallet</span><span>House 50% · Cases & Battles 100% · Slots 0%</span></footer>
  </ModalContent>
 </Modal>;
}
