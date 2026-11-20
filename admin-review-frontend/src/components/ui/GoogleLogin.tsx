"use client";

import { useEffect, useState } from "react";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { googleChallenge, googleLogin, GoogleAuthError, type AuthResponse } from "@/lib/api/auth";
import { useAuthStore } from "@/store/auth.store";
import { initializeWebSocket } from "@/lib/websocket";

type Props = {
  onSuccess?: (response: AuthResponse) => void;
  useModalStyle?: boolean;
  agreeToTerms?: boolean;
  mode?: "login" | "signup";
};

function GoogleButton({ onSuccess, agreeToTerms = false, mode = "login" }: Props) {
  const [nonce, setNonce] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const loading = useAuthStore(s => s.isLoading);
  useEffect(() => {
    let active = true;
    setNonce(null);
    googleChallenge().then(value => { if (active) setNonce(value); }).catch(() => {
      if (active) setError("Google sign-in is temporarily unavailable. Please use email sign-in or retry.");
    });
    return () => { active = false; };
  }, [attempt]);
  const restart = () => { setPending(null); setPassword(""); setError(null); setAttempt(a => a + 1); };
  async function finish(credential: string, accountPassword?: string) {
    if (!nonce || loading) return;
    if (mode === "signup" && !agreeToTerms) {
      setError("Confirm you are 18+ and agree to the terms before signing up.");
      return;
    }
    setError(null);
    useAuthStore.getState().setLoading(true);
    try {
      const response = await googleLogin(credential, nonce, agreeToTerms, accountPassword);
      useAuthStore.getState().setAuth(response.user, response.token);
      initializeWebSocket(response.token);
      setPending(null);
      setPassword("");
      onSuccess?.(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
      if (err instanceof GoogleAuthError && (err.code === "GOOGLE_LINK_PASSWORD_REQUIRED" || (err.code === "INVALID_CREDENTIALS" && pending))) {
        setPending(credential);
      } else { setPending(null); setNonce(null); }
    } finally {
      setPassword("");
      useAuthStore.getState().setLoading(false);
    }
  }
  return <div style={{ colorScheme: "light" }} className="flex w-full flex-col items-center gap-3">
    <div className="flex w-full items-center gap-3 text-xs text-text-muted"><span className="h-px flex-1 bg-white/10" />or continue with Google<span className="h-px flex-1 bg-white/10" /></div>
    {loading ? <p role="status" className="text-sm text-text-muted">Signing in…</p> :
      pending ? <form className="flex w-full flex-col gap-3" onSubmit={e => { e.preventDefault(); void finish(pending,password); }}>
        <label className="text-sm text-white" htmlFor="google-link-password">Confirm your existing account password</label>
        <input id="google-link-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={72} className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white" />
        <button type="submit" disabled={loading || !password} className="rounded-xl bg-primary-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Connect Google and sign in</button>
        <button type="button" onClick={restart} className="text-xs text-text-muted underline">Cancel</button>
      </form> : nonce ? <div inert={mode === "signup" && !agreeToTerms} className={mode === "signup" && !agreeToTerms ? "opacity-50" : ""}><GoogleLogin containerProps={{ style: { colorScheme: "light", background: "transparent" } }} key={nonce} nonce={nonce} theme="filled_black" size="large" width="320" shape="pill" text={mode === "signup" ? "signup_with" : "signin_with"} auto_select={false} useOneTap={false} onSuccess={r => { if (r.credential) void finish(r.credential); else { setError("Google did not return a credential. Please retry."); setNonce(null); } }} onError={() => { setError("Google sign-in could not start. Please retry."); setNonce(null); }} /></div> : !error ? <p role="status" className="text-xs text-text-muted">Loading Google sign-in…</p> : null}
    {mode === "signup" && !agreeToTerms && <p className="text-center text-xs text-text-muted">Confirm you are 18+ and agree to the terms to continue with Google.</p>}
    {error && <p role="alert" className="text-center text-sm text-red-400">{error}</p>}
    {error && !pending && <button type="button" onClick={restart} disabled={loading} className="text-xs text-primary-400 underline">Retry Google sign-in</button>}
  </div>;
}
export default function GoogleLoginButton(props: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  if (!clientId || !/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)) return null;
  return <GoogleOAuthProvider clientId={clientId}><GoogleButton {...props} /></GoogleOAuthProvider>;
}
