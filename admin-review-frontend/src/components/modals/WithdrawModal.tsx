"use client";
import {useEffect,useRef,useState} from 'react';
import {Modal,ModalContent,ModalHeader,ModalBody,Button} from '@heroui/react';
import {addToast} from '@/lib/toast';
import {createCartWithdrawal,getWithdrawalEligibility,requestBalanceWithdrawal,type WithdrawalEligibility} from '@/lib/api/withdrawals';
import {withdrawalCoins,withdrawalCoin,validWithdrawalAddress} from '@/lib/withdrawal-coins';
const money=(v:unknown)=>Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
interface Props{onClose:()=>void;totalAmount?:number;cartItemIds?:string[];embedded?:boolean;active?:boolean;onBusyChange?:(busy:boolean)=>void;}
export default function WithdrawModal({onClose,totalAmount=0,cartItemIds=[],embedded=false,active=true,onBusyChange}:Props){
 const cartMode=cartItemIds.length>0,fee=cartMode?0.5:0;
 const [eligibility,setEligibility]=useState<WithdrawalEligibility|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[coin,setCoin]=useState('usdt'),[address,setAddress]=useState(''),[amount,setAmount]=useState(''),[busy,setBusy]=useState(false);
 const key=useRef(''),submitting=useRef(false),selected=withdrawalCoin(coin)!;
 const requested=cartMode?Math.round((totalAmount-fee)*100)/100:Number(amount),amountValid=cartMode?requested>=15:/^\d{1,9}(\.\d{1,2})?$/.test(amount.trim())&&requested>=15;
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false)},[busy,onBusyChange]);
 useEffect(()=>{if(!active)return;setLoading(true);let activeRequest=true;getWithdrawalEligibility().then(data=>{if(activeRequest)setEligibility(data)}).catch(()=>{if(activeRequest)setError('Could not load withdrawal eligibility. Close this window and try again.')}).finally(()=>{if(activeRequest)setLoading(false)});return()=>{activeRequest=false}},[active]);
 const reset=()=>{key.current='';setError('')};
 async function submit(event:React.FormEvent){event.preventDefault();if(submitting.current)return;if(!eligibility?.canWithdraw||!amountValid||!validWithdrawalAddress(coin,address))return;
   submitting.current=true;setBusy(true);setError('');if(!key.current)key.current=crypto.randomUUID();
   try{
     if(cartMode)await createCartWithdrawal({intentId:key.current,token:coin,address,cartItemIds});
     else await requestBalanceWithdrawal({amount:requested,token:coin,address,requestId:key.current});
     addToast({title:'Withdrawal requested',description:'Your request is pending admin review.',color:'success'});onClose();
   }catch(cause){setError(cause instanceof Error?cause.message:'Could not submit this request. Check your withdrawal history before retrying.');try{setEligibility(await getWithdrawalEligibility())}catch{}}
   finally{submitting.current=false;setBusy(false)}
 }
 const wageringPercent=eligibility&&Number(eligibility.required)>0?Math.min(100,Math.max(0,Number(eligibility.progress)/Number(eligibility.required)*100)):100;
 const field='mt-2 w-full min-w-0 rounded-xl border border-white/15 bg-black/25 px-3 py-3 text-base text-white outline-none focus:border-violet-300 disabled:opacity-50';
 const Body=embedded?'div':ModalBody;
 const content=<> {!embedded&&<ModalHeader>{cartMode?'Withdraw cart value':'Withdraw balance'}</ModalHeader>}<Body className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4 pb-6">
   <p className="text-sm text-white/60">Minimum withdrawal: $15.00.</p>
   {loading?<p role="status">Checking balance and wagering progress…</p>:eligibility&&<div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"><p>Available balance <strong className="float-right">{money(eligibility.balance)}</strong></p><p className="mt-2 text-white/65">Total wagering required: <strong>{money(eligibility.required)}</strong></p><p className="mt-2 text-white/65">Completed qualifying wagers: <strong>{money(eligibility.progress)}</strong></p><p className="mt-2 text-white/65">Remaining wagering: <strong>{money(eligibility.remaining)}</strong></p><div role="progressbar" aria-label="Withdrawal wagering progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(wageringPercent)} className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-400" style={{width:`${wageringPercent}%`}}/></div>{eligibility.bonus&&<p className="mt-2 text-violet-200">{eligibility.bonus.code}: {money(eligibility.bonus.bonus)} bonus · {money(eligibility.bonus.required)} required · {money(eligibility.bonus.remaining)} remaining.</p>}{eligibility.tipWagering&&Number(eligibility.tipWagering.required)>0&&<p className="mt-2 text-violet-200">Received tips: {money(eligibility.tipWagering.received)} · Recorded wagering required: {money(eligibility.tipWagering.required)} · {money(eligibility.tipWagering.remaining)} remaining. New tips require 5×; earlier tips keep their recorded requirement. House wagers count 50%; Cases and Battles count 100%.</p>}{!eligibility.canWithdraw&&Number(eligibility.remaining)===0&&<p className="mt-2 text-amber-200">Withdrawals are restricted for this account. Contact support.</p>}{Number(eligibility.remaining)>0&&<p className="mt-2 text-amber-200">Wager this remaining amount in completed games before withdrawing. Non-bonus deposits require 1×. House wagers count 50%; Cases and Battles count 100%.{eligibility.bonus&&<> Your accepted streamer bonus requires {eligibility.bonus.multiplier}× (deposit + bonus), instead of 1×. Existing claims keep their accepted terms.</>}</p>}</div>}
   <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
    <label className="text-sm">Coin and network<select value={coin} disabled={busy} onChange={e=>{setCoin(e.target.value);setAddress('');reset()}} className={field}>{withdrawalCoins.map(c=><option key={c.id} value={c.id} className="bg-[#1e1f23]">{c.symbol} — {c.network}</option>)}</select></label>
    {cartMode?<div className="rounded-xl bg-white/5 p-3 text-sm"><p>Cart value: {money(totalAmount)}</p><p>Fee: {money(fee)}</p><p className="mt-2 font-semibold">Withdrawal request: {money(requested)}</p></div>:<label className="text-sm">Amount (USD)<input aria-label="Withdrawal amount in USD" inputMode="decimal" autoComplete="off" placeholder="Minimum $15.00" value={amount} onChange={e=>{setAmount(e.target.value);reset()}} disabled={busy} className={field}/></label>}
    <label className="text-sm">{selected.network} destination address<input aria-label="Withdrawal destination address" autoComplete="off" spellCheck={false} maxLength={255} value={address} onChange={e=>{setAddress(e.target.value);reset()}} disabled={busy} className={field} placeholder={`Enter ${selected.symbol} address`}/></label>
    <p className="text-xs leading-relaxed text-white/60">Use only {selected.symbol} on {selected.network}. Confirm the network and address before submitting.</p>
    {error&&<p role="alert" className="break-words text-sm text-red-300">{error}</p>}
    {!cartMode&&amountValid&&requested>Number(eligibility?.balance||0)&&<p role="alert" className="text-sm text-amber-200">Insufficient balance.</p>}
    {cartMode&&requested<15&&<p role="alert" className="text-sm text-amber-200">Select at least $15.50 in cart items to cover the $15 minimum and displayed fee.</p>}
    <Button type="submit" isLoading={busy} isDisabled={loading||busy||!eligibility?.canWithdraw||!amountValid||!validWithdrawalAddress(coin,address)||(!cartMode&&requested>Number(eligibility?.balance||0))} className="h-12 w-full mcPrimary font-semibold text-white">Request withdrawal</Button>
    <button type="button" disabled={busy} onClick={onClose} className="py-2 text-sm text-white/60">Cancel</button>
   </form>
  </Body></>;
 if(embedded)return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{content}</div>;
 return <Modal isOpen onClose={onClose} placement="center" scrollBehavior="inside" size="lg" isDismissable={!busy} isKeyboardDismissDisabled={busy} hideCloseButton={busy} classNames={{base:'m-3 max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] bg-[#1e1f23] text-white border border-white/10 rounded-2xl',backdrop:'bg-black/60'}}><ModalContent>{content}</ModalContent></Modal>;
}
