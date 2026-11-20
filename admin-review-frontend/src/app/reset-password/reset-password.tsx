"use client";
import { useEffect,useState,useRef } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth.store";
export default function ResetPassword(){
 const initialized=useRef(false);
 const [token,setToken]=useState<string|null>(null),[ready,setReady]=useState(false);
 const [password,setPassword]=useState(""),[confirmation,setConfirmation]=useState("");
 const [busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(initialized.current)return;initialized.current=true;const value=new URLSearchParams(window.location.hash.slice(1)).get('token');setToken(value&&/^[a-f0-9]{64}$/.test(value)?value:null);window.history.replaceState(null,'',window.location.pathname);setReady(true);},[]);
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy||!token)return;setError("");
  if(password!==confirmation){setError("The passwords do not match.");return;}
  const bytes=new TextEncoder().encode(password).length;
  if(bytes<10||bytes>72){setError("Use a password between 10 and 72 bytes. Avoid common passwords.");return;}
  setBusy(true);
  try{await apiClient.post('/auth/password/reset',{token,password});useAuthStore.getState().logout();setPassword("");setConfirmation("");setToken(null);setDone(true);}
  catch(e:any){const code=e?.response?.data?.error;setError(code==='RESET_INVALID'?"This reset link is invalid or expired. Request a new link.":code==='INVALID_PASSWORD'?"Choose a stronger password: 10–72 bytes, not a common password, your username or email.":e?.response?.status===429?"Too many attempts. Please try again later.":"We couldn’t reset your password. Please try again.");}
  finally{setBusy(false);}
 }
 return <main className="mx-auto w-full max-w-xl px-5 py-16"><section className="rounded-2xl border border-violet-300/20 bg-[#16171b] p-6 sm:p-9">
  <p className="text-xs uppercase tracking-widest text-violet-300">Account recovery</p><h1 className="mt-3 text-3xl font-semibold text-white">{done?"Password updated":"Choose a new password"}</h1>
  {!ready?<p className="mt-5 text-white/70" role="status">Checking link…</p>:done?<div role="status" className="mt-5 text-sm leading-7 text-white/75"><p>Your password has been changed and existing sessions signed out. Sign in with your new password.</p><Link href="/" className="mt-6 inline-block text-violet-200 underline">Return to GalaxyBets to sign in</Link></div>:!token?<p className="mt-5 text-sm leading-7 text-white/70">Open the link from your reset email, or request a new link below.</p>:<form onSubmit={submit} className="mt-6 space-y-4">
  <label htmlFor="new-password" className="block text-sm font-medium text-white">New password</label><input id="new-password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} disabled={busy} className="h-12 w-full rounded-xl border border-violet-300/25 bg-[#0f1013] px-4 text-white outline-none focus:border-violet-400" />
  <p className="text-xs leading-6 text-white/60">Use at least 10 characters. Avoid common passwords and your username or email.</p>
  <label htmlFor="confirm-password" className="block text-sm font-medium text-white">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" required maxLength={72} value={confirmation} onChange={e=>setConfirmation(e.target.value)} disabled={busy} className="h-12 w-full rounded-xl border border-violet-300/25 bg-[#0f1013] px-4 text-white outline-none focus:border-violet-400" />
  <button type="submit" disabled={busy} className="min-h-12 w-full rounded-xl bg-gradient-to-b from-violet-400 to-violet-700 px-5 font-semibold text-white disabled:opacity-50">{busy?"Updating password…":"Update password"}</button></form>}
  {error&&<p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
  {!done&&<Link href="/forgot-password" className="mt-7 inline-block text-sm text-violet-200 underline">Request a new reset link</Link>}
 </section></main>;
}
