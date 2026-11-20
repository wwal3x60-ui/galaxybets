"use client";
import { useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
export default function PasswordRecovery() {
 const [email,setEmail]=useState("");
 const [busy,setBusy]=useState(false);
 const [sent,setSent]=useState(false);
 const [error,setError]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;setBusy(true);setError("");
  try{await apiClient.post('/auth/password/forgot',{email:email.trim()});setSent(true);}
  catch(e:any){setError(e?.response?.status===429?"Please wait a few minutes before requesting another link.":"Password recovery is temporarily unavailable. Please try again later.");}
  finally{setBusy(false);}
 }
 return <main className="mx-auto w-full max-w-xl px-5 py-16"><section className="rounded-2xl border border-violet-300/20 bg-[#16171b] p-6 sm:p-9">
  <p className="text-xs uppercase tracking-widest text-violet-300">Account recovery</p><h1 className="mt-3 text-3xl font-semibold text-white">Forgot your password?</h1>
  {sent?<div role="status" className="mt-6 space-y-4 text-sm leading-7 text-white/75"><p>If this email belongs to an eligible email/password account, a reset link will arrive shortly. Check your spam folder too.</p><p>The link expires after 20 minutes. Google-linked accounts should use Sign in with Google.</p><button type="button" onClick={()=>{setSent(false);setError("");}} className="text-violet-200 underline">Use another email or request a new link</button></div>:<>
  <p className="mt-4 text-sm leading-7 text-white/70">Enter the email you used to create your account. We’ll send you a link to choose a new password.</p>
  <form onSubmit={submit} className="mt-6 space-y-4"><label htmlFor="recovery-email" className="block text-sm font-medium text-white">Email address</label><input id="recovery-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy} className="h-12 w-full rounded-xl border border-violet-300/25 bg-[#0f1013] px-4 text-white outline-none focus:border-violet-400" />
  <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-gradient-to-b from-violet-400 to-violet-700 px-5 font-semibold text-white disabled:opacity-50">{busy?"Requesting link…":"Send reset link"}</button></form>
  <p className="mt-5 text-xs leading-6 text-white/60">Signed up with Google? Continue using Sign in with Google.</p></>}
  {error&&<p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
  <Link href="/" className="mt-7 inline-block text-sm text-violet-200 underline">Back to GalaxyBets</Link>
 </section></main>;
}
