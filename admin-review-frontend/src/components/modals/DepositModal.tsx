"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Snippet } from "@heroui/react";
import { useAuthStore } from "@/store/auth.store";
import { BONUS_TERMS_VERSION, DEPOSIT_ADDRESSES, submitCryptoDeposit, getDepositBonusOffer, type DepositBonusOffer } from "@/lib/api/deposits";

import { redeemAffiliateCode, affiliateErrorMessage } from "@/lib/api/affiliates";

const coins = [
  ["SOL", "Solana"], ["USDT", "Tether"], ["TRX", "Tron"],
  ["LTC", "Litecoin"], ["DOGE", "Dogecoin"], ["ETH", "Ethereum"],
  ["BNB", "BNB"], ["USDC", "USD Coin"],
];

export default function DepositModal({ onClose, embedded=false, onBusyChange }: { onClose: () => void; embedded?:boolean; onBusyChange?:(busy:boolean)=>void }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [bonusExpanded,setBonusExpanded]=useState(false);
  const [coin, setCoin] = useState("SOL");
  const [details, setDetails] = useState(false);
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [bonusCode,setBonusCode]=useState('');
  const [bonusAccepted,setBonusAccepted]=useState(false);
  const [bonusOffer,setBonusOffer]=useState<DepositBonusOffer|null>(null);
  const [bonusLoading,setBonusLoading]=useState(false);
  const [bonusError,setBonusError]=useState('');
  useEffect(()=>{onBusyChange?.(pending);return()=>onBusyChange?.(false)},[pending,onBusyChange]);
  const submitting = useRef(false);
  const depositFormId = useId();
  useEffect(() => { document.getElementById(`${depositFormId}-body`)?.scrollTo({ top: 0 }); }, [details, requestId, depositFormId]);
  const config = DEPOSIT_ADDRESSES[coin];
  const amountText = amount.trim();
  const hashText = txHash.trim();
  const valid = /^\d{1,9}(\.\d{1,2})?$/.test(amountText)
    && Number(amountText) >= 5 && hashText.length > 0 && hashText.length <= 255;

  const wantsBonus=bonusCode.trim().length>0;
  useEffect(()=>{
    if(!isAuthenticated||requestId!==null)return;
    let active=true;setBonusLoading(true);setBonusError('');setBonusOffer(null);setBonusAccepted(false);
    const timer=setTimeout(()=>{getDepositBonusOffer(amountText,bonusCode).then(value=>{if(active)setBonusOffer(value)}).catch(cause=>{if(active)setBonusError(cause instanceof Error?cause.message:'Could not verify bonus.')}).finally(()=>{if(active)setBonusLoading(false)})},250);
    return()=>{active=false;clearTimeout(timer)};
  },[amountText,bonusCode,isAuthenticated,requestId]);
  const bonusValid=!wantsBonus||Boolean(!bonusLoading&&!bonusError&&bonusOffer?.eligible&&bonusOffer.version===BONUS_TERMS_VERSION&&!bonusOffer.needsAffiliateLink&&bonusAccepted&&bonusOffer.quote&&Number(bonusOffer.quote.deposit)===Number(amountText));
  const reasonText=bonusOffer?.reason==='BONUS_ALREADY_CLAIMED'?'You have already claimed this bonus.':bonusOffer?.reason==='BONUS_FIRST_DEPOSIT_ONLY'?'You already have a confirmed deposit. This offer is first-deposit only.':'This account is not eligible for this offer.';
  async function activateStreamerCode(){
    if(pending)return;setPending(true);setBonusError('');
    try{await redeemAffiliateCode(bonusCode.trim());setBonusOffer(await getDepositBonusOffer(amountText,bonusCode));setBonusAccepted(false);}
    catch(cause){setBonusError(affiliateErrorMessage(cause));}
    finally{setPending(false);}
  }
  const bonusPanel=<section aria-label="First deposit bonus" className="space-y-3 rounded-xl border border-violet-400/25 bg-violet-400/5 p-3">
    <label htmlFor="deposit-bonus-code" className="block text-sm font-medium">Bonus code (optional)</label>
    <input id="deposit-bonus-code" value={bonusCode} maxLength={20} disabled={pending} autoComplete="off" spellCheck={false} placeholder="Enter a bonus code" onChange={e=>{setBonusCode(e.target.value);setBonusAccepted(false);}} className="w-full rounded-lg border border-white/15 bg-black/25 px-3 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"/>
    <p className="text-xs leading-relaxed text-gray-400">Any active streamer affiliate code: 10%–50% on your first confirmed deposit, up to $500 bonus. Minimum qualifying deposit: $40. Current and future streamer codes qualify. Activate your code below before sending funds; existing affiliate links cannot be switched.</p>
    <details className="text-xs text-gray-300"><summary className="cursor-pointer py-1">Bonus tiers and terms</summary><table className="mt-2 w-full text-left"><caption className="sr-only">Streamer first-deposit bonus tiers</caption><thead><tr><th>Deposit</th><th>Bonus</th></tr></thead><tbody><tr><td>$40–$149.99</td><td>10%</td></tr><tr><td>$150–$249.99</td><td>20%</td></tr><tr><td>$250–$399.99</td><td>30%</td></tr><tr><td>$400–$499.99</td><td>40%</td></tr><tr><td>$500+</td><td>50%, capped at $500</td></tr></tbody></table><p className="mt-2 leading-relaxed">One claim per user, first confirmed deposit only. Enter the code before submitting your deposit. Depositing without the code uses your first-deposit eligibility. Pending or rejected deposits do not count as confirmed. If several requests are pending, only the first approved deposit can qualify. Bonus is credited after cashier approval; it is recorded separately and joins your playable balance. Withdrawals and tips are locked until 5× (deposit + bonus) is wagered in qualifying completed games placed after approval. Later non-bonus deposits require the normal 1×. The bonus requirement replaces, rather than adds to, the normal 1× for this deposit. Bonus is rounded down to cents; wagering is calculated in cents. Previously accepted claims keep their original requirement.</p></details>
    {wantsBonus&&bonusOffer&&bonusOffer.version!==BONUS_TERMS_VERSION&&<p role="alert" className="text-xs text-red-300">Bonus terms are being updated. Refresh after the update is complete before claiming the bonus.</p>}
    {wantsBonus&&bonusOffer?.eligible&&bonusOffer.streamerName&&<p className="text-xs text-gray-300">Streamer: {bonusOffer.streamerName} · {bonusOffer.code}</p>}
    {wantsBonus&&bonusOffer?.eligible&&bonusOffer.needsAffiliateLink&&<Button type="button" isLoading={pending} isDisabled={pending||bonusLoading} onPress={activateStreamerCode} className="w-full mcPrimary text-white">Activate {bonusOffer.code} affiliate code</Button>}
    {wantsBonus&&bonusLoading&&<p role="status" className="text-xs">Checking bonus eligibility…</p>}
    {wantsBonus&&bonusError&&<p role="alert" className="text-xs text-red-300">{bonusError}</p>}
    {wantsBonus&&bonusOffer&&!bonusOffer.eligible&&<p role="alert" className="text-xs text-amber-200">{reasonText} Remove the code to continue without a bonus.</p>}
    {wantsBonus&&bonusOffer?.eligible&&bonusOffer.quote&&<div role="status" className="space-y-1 text-sm"><p>Estimated bonus: <strong>${bonusOffer.quote.bonus} ({bonusOffer.quote.rate}%)</strong></p><p>Total playable credit: ${bonusOffer.quote.creditedTotal}</p><p>Wagering required: <strong>${bonusOffer.quote.required}</strong> · 5× (deposit + bonus)</p></div>}
    {wantsBonus&&bonusOffer?.eligible&&!bonusOffer.quote&&<p className="text-xs text-gray-300">Enter the deposit amount on the next step to see the exact bonus and wagering requirement.</p>}
    {wantsBonus&&<label className="flex items-start gap-2 text-xs leading-relaxed"><input type="checkbox" checked={bonusAccepted} onChange={e=>setBonusAccepted(e.target.checked)} disabled={pending||bonusLoading||!!bonusError||!bonusOffer?.eligible} className="mt-1"/>I accept this streamer code and the first-deposit terms and the 5× wagering requirement on deposit plus bonus before withdrawal or tipping.</label>}
  </section>;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || requestId !== null) return;
    if (!isAuthenticated) { setError("Please log in to submit a deposit request."); return; }
    if (!valid || !config) { setError("Minimum deposit is $5.00. Enter up to 2 decimals and a transaction hash."); return; }
    if(!bonusValid){setError("Verify the bonus amount and accept its wagering terms, or remove the code.");return;}
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const result = await submitCryptoDeposit({ amount: Number(amountText), coin, txHash: hashText, ...(wantsBonus?{bonusCode:bonusCode.trim(),bonusTermsAccepted:bonusAccepted,bonusVersion:bonusOffer?.quote?.version}: {}) });
      setRequestId(result.transactionId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit the deposit. Please try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-white/15 bg-[#0f1013] px-3 py-2 text-white outline-none focus:border-violet-400 disabled:opacity-50";

  const Body=embedded?'div':ModalBody;
  const content = (<>
        {!embedded&&<ModalHeader className="shrink-0">Deposit Funds</ModalHeader>}
        <Body id={`${depositFormId}-body`} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4" style={{ minHeight: 0, overflowY: "auto", flex: "1 1 auto", overscrollBehavior: "contain" }}>
          {requestId !== null ? (
            <div role="status" className="space-y-4">
              <p className="text-green-400 font-medium">Deposit request submitted</p>
              <p>Request #{requestId} is pending admin approval. Your balance will be credited after approval.</p>
              <a href="/account/deposits" className="text-blue-400 underline">View deposit history</a>
            </div>
          ) : !details ? (
            <>
              <p className="text-sm text-gray-400">Choose your currency and network. Minimum deposit $5.00. Your payment is credited after cashier approval. Deposits without a bonus require 1× wagering. Deposits without a bonus require 1× wagering.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {coins.filter(([symbol]) => DEPOSIT_ADDRESSES[symbol]).map(([symbol, name]) => (
                  <Button key={symbol} onPress={() => setCoin(symbol)} aria-pressed={coin === symbol}
                    className={`h-[88px] min-w-0 flex-col gap-1 rounded-xl text-white ${coin === symbol ? "border border-violet-400 bg-violet-400/15 shadow-[inset_0_0_0_1px_rgba(192,132,252,.25)]" : "border border-white/10 bg-white/[.035] hover:bg-white/[.07]"}`}>
                    <span className="text-xs font-bold tracking-wide text-violet-200">{symbol}</span><span className="text-sm">{name}</span><span className="max-w-full truncate text-[10px] text-white/45">{DEPOSIT_ADDRESSES[symbol]?.network}</span>
                  </Button>
                ))}
              </div>
              {<div className="space-y-3"><button type="button" disabled={pending} onClick={()=>setBonusExpanded(v=>!v)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[.025] px-4 py-3 text-left text-sm"><span>Have a bonus code?</span><span className="text-xs text-violet-300">{bonusExpanded||wantsBonus?"View terms below":"Optional +"}</span></button>{(bonusExpanded||wantsBonus)&&bonusPanel}</div>}
              {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
              {!isAuthenticated && <p role="alert">Please log in to submit a deposit request.</p>}
            </>
          ) : (
            <form id={depositFormId} onSubmit={submit} className="flex flex-col gap-4">
              {<div className="space-y-3"><button type="button" disabled={pending} onClick={()=>setBonusExpanded(v=>!v)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[.025] px-4 py-3 text-left text-sm"><span>Have a bonus code?</span><span className="text-xs text-violet-300">{bonusExpanded||wantsBonus?"View terms below":"Optional +"}</span></button>{(bonusExpanded||wantsBonus)&&bonusPanel}</div>}
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <p className="font-medium">{coin} — {config?.network}</p>
                <p className="text-sm text-gray-400">Wallet address</p>
                <Snippet symbol="" className="w-full bg-black/20 text-white" classNames={{ pre: "whitespace-normal break-all min-w-0", content: "min-w-0" }}>{config?.address}</Snippet>
                <p className="text-xs text-gray-400">Use only {coin} on {config?.network}. Submit the USD value and transaction hash below for review.</p>
              </div>
              <label htmlFor="deposit-usd-amount" className="text-sm">Amount sent (USD value)</label>
              <input id="deposit-usd-amount" type="text" inputMode="decimal" placeholder="Minimum $5.00" autoComplete="off"
                value={amount} onChange={(event) => {setAmount(event.target.value);setBonusAccepted(false);}} disabled={pending} className={inputClass} />
              <label htmlFor="deposit-tx-hash" className="text-sm">Transaction hash / ID</label>
              <input id="deposit-tx-hash" type="text" placeholder="Paste the transaction hash / ID" autoComplete="off" maxLength={255}
                value={txHash} onChange={(event) => setTxHash(event.target.value)} disabled={pending} className={inputClass} />
              {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
              <p className="text-xs text-gray-400">Submitting creates a pending request. It does not credit your balance automatically. Bonus eligibility is checked again at approval. Your bonus uses your activated streamer affiliate code. One first-deposit bonus per user across all codes.</p>
            </form>
          )}
        </Body>
        <ModalFooter className="flex-col gap-2 border-t border-white/10 bg-[#1e1f23]" style={{ flexShrink: 0, paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}>
          {requestId !== null ? (
            <Button onPress={onClose} className="min-h-12 w-full shrink-0 mcPrimary font-semibold text-white">Done</Button>
          ) : !details ? (
            <>
              {wantsBonus && !bonusLoading && !bonusError && bonusOffer?.eligible && (bonusOffer.needsAffiliateLink || !bonusAccepted) && <p role="status" className="w-full text-xs text-gray-300">{bonusOffer.needsAffiliateLink ? "Activate your streamer code above to continue." : "Accept the bonus terms above to continue."}</p>}
              <Button type="button" isDisabled={!isAuthenticated || !config || (wantsBonus&&(bonusLoading||!!bonusError||!bonusOffer?.eligible||bonusOffer.version!==BONUS_TERMS_VERSION||bonusOffer.needsAffiliateLink||!bonusAccepted))||pending} onPress={() => setDetails(true)} className="min-h-12 w-full shrink-0 mcPrimary font-semibold text-white">Continue with {coin}</Button>
            </>
          ) : (
            <div className="flex w-full gap-2">
              <Button type="button" isDisabled={pending} onPress={() => { setDetails(false); setError(""); }} className="min-h-12 flex-1 bg-white/10 text-white">Back</Button>
              <Button type="submit" form={depositFormId} isLoading={pending} isDisabled={!valid || !isAuthenticated || pending || !bonusValid} className="min-h-12 flex-1 mcPrimary font-semibold text-white">Submit deposit request</Button>
            </div>
          )}
        </ModalFooter>
  </>);
  if(embedded)return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{content}</div>;
  return <Modal isOpen onClose={onClose} isDismissable={!pending} isKeyboardDismissDisabled={pending} hideCloseButton={pending} size="lg" placement="center" scrollBehavior="inside" classNames={{base:"bg-[#1e1f23] text-white border border-white/10 rounded-[20px]",backdrop:"bg-black/60"}}><ModalContent style={{display:"flex",flexDirection:"column",maxHeight:"calc(100dvh - 24px)",overflow:"hidden"}}>{content}</ModalContent></Modal>;
}
