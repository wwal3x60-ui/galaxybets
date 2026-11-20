'use client';
import {useEffect,useId,useRef,useState} from 'react';
import Link from 'next/link';
import {Button} from '@heroui/react';
import {useAuthStore} from '@/store/auth.store';
import {useModalStore} from '@/store/modal.store';
import {apiClient} from '@/lib/api/client';
import {sendTip,communityError} from '@/lib/api/community';
import styles from './CashierModal.module.css';
interface Policy{maxTip:string;streamerDailyLimit:string;streamerRecipientDailyLimit:string;tipWageringMultiplier:string;}
export default function CashierTips({onBusyChange}:{onBusyChange:(busy:boolean)=>void}){
 const {user,isAuthenticated,updateUser}=useAuthStore(),id=useId();
 const [username,setUsername]=useState(''),[amount,setAmount]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[policy,setPolicy]=useState<Policy|null>(null),[policyError,setPolicyError]=useState('');
 const requestId=useRef(''),lock=useRef(false);
 const role=String(user?.role||'').toUpperCase(),admin=['ADMIN','OWNER'].includes(role),streamer=role==='STREAMER',minimum=(admin||streamer)?0.01:1;
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false)},[busy,onBusyChange]);
 useEffect(()=>{let active=true;apiClient.get('/community/tipping-config').then(r=>{const p=r.data;if(!p||!Number.isFinite(Number(p.maxTip))||Number(p.maxTip)<=0||!Number.isFinite(Number(p.tipWageringMultiplier)))throw Error('Invalid tip policy');if(active)setPolicy(p)}).catch(()=>{if(active)setPolicyError('Could not load tip limits. Close the cashier and try again.')});return()=>{active=false}},[]);
 const valid=/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(amount)&&Number(amount)>=minimum&&(admin||Number(amount)<=Number(policy?.maxTip||0));
 function reset(){requestId.current='';setError('');setSuccess('')}
 async function submit(event:React.FormEvent){event.preventDefault();if(lock.current||!policy||!valid||!isAuthenticated||!username.trim())return;
  lock.current=true;setBusy(true);setError('');setSuccess('');if(!requestId.current)requestId.current=crypto.randomUUID();
  try{const result=await sendTip(username.trim(),amount,requestId.current);updateUser({walletBalance:result.balance});setSuccess(`Sent $${Number(result.amount).toFixed(2)} to ${result.username}.`);requestId.current='';setAmount('');try{const {data}=await apiClient.get('/user');const balance=(data.user??data).balance;if(balance!==undefined&&Number.isFinite(Number(balance)))updateUser({walletBalance:String(balance)})}catch{}}
  catch(cause){setError(communityError(cause))}finally{lock.current=false;setBusy(false)}
 }
 return <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4 pb-6">
  <div className={styles.sectionIntro}><h3>Send a tip</h3><p>Transfer from your wallet to another player. Review their username before sending.</p></div>
  {!isAuthenticated?<div className={styles.notice}><p>Log in to send a tip.</p><Button className="mcPrimary mt-3 text-white" onPress={()=>useModalStore.getState().open('login')}>Log in</Button></div>:<form onSubmit={submit} className={styles.tipForm}>
   <label htmlFor={`${id}-recipient`}>Recipient username<input id={`${id}-recipient`} autoComplete="off" placeholder="Enter player username" minLength={3} maxLength={32} required value={username} disabled={busy} onChange={e=>{setUsername(e.target.value);reset()}}/></label>
   <label htmlFor={`${id}-amount`}>Amount in USD<div className={styles.amountInput}><span>$</span><input id={`${id}-amount`} inputMode="decimal" autoComplete="off" placeholder={streamer||admin?'0.01':'1.00'} required value={amount} disabled={busy} onChange={e=>{setAmount(e.target.value);reset()}}/></div></label>
   {policy&&<div className={styles.limits}><span>Minimum <strong>${minimum.toFixed(2)}</strong></span><span>Maximum <strong>{admin?'Admin exempt':`$${Number(policy.maxTip).toFixed(2)}`}</strong></span></div>}
   {streamer&&policy&&<p className={styles.notice}>Streamer limits: ${policy.streamerDailyLimit} total and ${policy.streamerRecipientDailyLimit} per recipient, per UTC day. Reset at 00:00 UTC.</p>}
   {!streamer&&!admin&&<p className={styles.subtle}>Level 5, a recent approved deposit and your account’s tip limits apply. Complete deposit-bonus wagering before tipping.</p>}
   <div className={styles.notice}><strong>Received-tip wagering</strong><p>{policy?`${policy.tipWageringMultiplier}×`:'Loading'} wagering applies to new received tips before withdrawal. Earlier tips retain their recorded terms.</p><p>House games count 50%. Cases and Battles count 100%. Slots do not count.</p></div>
   {policyError&&<p role="alert" className={styles.error}>{policyError}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}{success&&<p role="status" className={styles.success}>{success}</p>}
   <Button type="submit" isLoading={busy} isDisabled={busy||!policy||!valid||!/^[A-Za-z0-9_]{3,32}$/.test(username.trim())} className="min-h-12 w-full mcPrimary font-semibold text-white">Send tip{valid?` · $${Number(amount).toFixed(2)}`:''}</Button>
   <p className={styles.subtle}>Tips are final. <Link href="/account/dashboard">View account ↗</Link></p>
  </form>}
 </div>;
}
