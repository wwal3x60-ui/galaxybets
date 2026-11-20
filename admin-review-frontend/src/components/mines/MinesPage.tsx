"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@heroui/react";
import Link from "next/link";
import OriginalsNav from "@/components/games/OriginalsNav";
import { useAuthStore } from "@/store/auth.store";
import { useModalStore } from "@/store/modal.store";
import { apiClient } from "@/lib/api/client";
import { getActiveMines, startMines, revealMines, cashoutMines, minesError, type MinesGame, type MinesMove } from "@/lib/api/mines";
import { formatCurrency } from "@/lib/utils/numbers";
import { motion, useReducedMotion } from "framer-motion";
import { unlockAudio, playMinesReveal as playBasicWin, playMinesCashout as playSpecialWin, playMinesLoss as playUpgradeFail } from "@/lib/audio";
import galaxyGameStyle from "@/components/games/GamePolish.module.css";
import { MinesTileFace, GameEmblem } from "@/components/games/GameVisuals";

type View = { phase: "idle" | "active" | "won" | "lost" | "unknown"; game: MinesGame | null; mines: number[]; hit: number | null; payout: number | null };
const empty: View = { phase: "idle", game: null, mines: [], hit: null, payout: null };

function TileIcon({ mine }: { mine: boolean }) {
  return mine ? <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 sm:h-9 sm:w-9" fill="none"><circle cx="14" cy="19" r="9" fill="currentColor" /><path d="M19 11l3-4m0 0l-1-3m1 3l4 1m-1-5l2-2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /><path d="M10 16l-1 2" stroke="#fff" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" /></svg>
    : <svg aria-hidden="true" viewBox="0 0 32 32" className="h-7 w-7 sm:h-9 sm:w-9" fill="none"><path d="M8 5h16l6 9-14 14L2 14 8 5Z" fill="currentColor" /><path d="M2 14h28M8 5l8 23 8-23M8 5l8 9 8-9" stroke="#fff" strokeOpacity=".35" strokeWidth="1.3" /></svg>;
}

export default function MinesPage() {
  const { token, hasHydrated, isAuthenticated, user } = useAuthStore();
  const { open } = useModalStore();
  const [view, setView] = useState<View>(empty);
  const viewRef = useRef(view);
  const [amount, setAmount] = useState("1.00");
  const [mineCount, setMineCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [roundVerified, setRoundVerified] = useState(false);
  const [pendingTile, setPendingTile] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const reducedMotion = useReducedMotion();
  const lock = useRef(false);
  const session = useRef(0);
  const readEpoch = useRef(0);
  const balanceEpoch = useRef(0);
  const setRound = (next: View) => { viewRef.current = next; setView(next); };

  const refreshBalance = async (expectedToken: string | null) => {
    const epoch = ++balanceEpoch.current;
    try {
      const response = await apiClient.get("/user");
      const balance = Number(response.data?.balance);
      const store = useAuthStore.getState();
      if (epoch === balanceEpoch.current && store.token === expectedToken && Number.isFinite(balance)) store.updateUser({ balance, walletBalance: String(balance) });
    } catch { /* The round result remains valid if the balance refresh fails. */ }
  };

  const checkRound = async (quiet = false) => {
    if (!token || lock.current) return;
    const version = session.current;
    const epoch = ++readEpoch.current;
    if (!quiet) setChecking(true);
    try {
      const game = await getActiveMines();
      if (version !== session.current || epoch !== readEpoch.current || lock.current) return;
      setRoundVerified(true);
      if (game) {
        setRound({ phase: "active", game, mines: [], hit: null, payout: null });
        setAmount(game.amount.toFixed(2)); setMineCount(game.minesCount);
        setMessage(null);
      } else if (viewRef.current.phase === "active" || viewRef.current.phase === "unknown") {
        setRound({ ...viewRef.current, phase: "unknown" });
        setMessage("The server has no active round. Its final result could not be recovered here. Check your account's bet history before starting again.");
      } else setMessage(null);
      void refreshBalance(token);
    } catch (error) {
      if (version === session.current && epoch === readEpoch.current) { setRoundVerified(false); setMessage(minesError(error)); }
    } finally {
      if (version === session.current && epoch === readEpoch.current) setChecking(false);
    }
  };

  useEffect(() => {
    session.current += 1; readEpoch.current += 1; balanceEpoch.current += 1; lock.current = false;
    setRound(empty); setBusy(false); setChecking(true); setMessage(null); setPendingTile(null);
    setRoundVerified(false);
    if (!hasHydrated) return;
    if (!isAuthenticated || !token) { setChecking(false); return; }
    void checkRound();
    const onFocus = () => { if (document.visibilityState === "visible") void checkRound(true); };
    document.addEventListener("visibilitychange", onFocus);
    return () => { session.current += 1; readEpoch.current += 1; document.removeEventListener("visibilitychange", onFocus); };
    // Requests are invalidated when the authenticated session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasHydrated, isAuthenticated]);

  const act = async (kind: "start" | "reveal" | "cashout", field?: number) => {
    if (lock.current || checking) return;
    if (!isAuthenticated || !token) { open("login"); return; }
    if (!roundVerified) { setMessage("Check your current round before playing."); return; }
    const previous = viewRef.current;
    if (kind === "start") {
      if (previous.phase === "active" || previous.phase === "unknown") return;
      if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) < 0.2 || Number(amount) > 10000) { setMessage("Enter a bet from $0.20 to $10,000.00, with up to two decimal places."); return; }
      if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) { setMessage("Choose between 1 and 24 mines."); return; }
    } else {
      if (previous.phase !== "active" || !previous.game) return;
      if (kind === "cashout" && previous.game.revealedTiles.length === 0) return;
      if (kind === "reveal" && (field == null || previous.game.revealedTiles.includes(field))) return;
    }
    if (soundEnabled) unlockAudio();
    lock.current = true; readEpoch.current += 1; balanceEpoch.current += 1;
    const version = session.current;
    setBusy(true); setChecking(false); setMessage(null); setPendingTile(field ?? null);
    try {
      if (kind === "start") {
        await startMines(Number(amount), mineCount);
        const game = await getActiveMines();
        if (version !== session.current) return;
        setRoundVerified(true);
        if (!game) throw new Error("Started round could not be restored.");
        setRound({ phase: "active", game, mines: [], hit: null, payout: null });
      } else {
        const result: MinesMove = kind === "reveal" ? await revealMines(field!) : await cashoutMines();
        if (version !== session.current) return;
        const game = previous.game!;
        if (result.outcome === "safe") {
          setRound({ phase: "active", game: { ...game, revealedTiles: result.revealedTiles, multiplier: result.multiplier, currentPayout: result.currentPayout }, mines: [], hit: null, payout: null });
          if (soundEnabled) playBasicWin();
        } else if (result.outcome === "lost") {
          setRound({ phase: "lost", game: { ...game, revealedTiles: result.revealedTiles, currentPayout: 0 }, mines: result.minePositions, hit: field ?? null, payout: 0 });
          if (soundEnabled) playUpgradeFail();
        }
        else {
          const revealed = field == null ? game.revealedTiles : [...new Set([...game.revealedTiles, field])];
          setRound({ phase: "won", game: { ...game, revealedTiles: revealed, multiplier: result.multiplier, currentPayout: result.payout }, mines: result.minePositions, hit: null, payout: result.payout });
          if (soundEnabled) playSpecialWin();
        }
      }
      void refreshBalance(token);
    } catch (error) {
      if (version !== session.current) return;
      setMessage(minesError(error));
      // A failed response might still have changed the round. Never repeat a POST.
      try {
        const game = await getActiveMines();
        if (version !== session.current) return;
        setRoundVerified(true);
        if (game) {
          setRound({ phase: "active", game, mines: [], hit: null, payout: null });
          setAmount(game.amount.toFixed(2)); setMineCount(game.minesCount);
        } else {
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (kind === "start" && status != null && status >= 400 && status < 500) setRound(previous);
          else { setRound({ ...previous, phase: "unknown" }); setMessage("This round may have ended, but the result was not received. Check your account's bet history and balance before starting again."); }
        }
      } catch { if (version === session.current) { setRoundVerified(false); setRound({ ...previous, phase: "unknown" }); } }
      void refreshBalance(token);
    } finally {
      if (version === session.current) { lock.current = false; setBusy(false); setPendingTile(null); }
    }
  };

  const active = view.phase === "active";
  const ended = view.phase === "won" || view.phase === "lost";
  const revealed = view.game?.revealedTiles ?? [];
  const safeFound = view.phase === "lost" ? Math.max(0, revealed.length - 1) : revealed.length;
  const controlsDisabled = busy || checking || active || view.phase === "unknown";
  const boardEnabled = active && !busy && !checking && roundVerified;

  return (
    <div className={[galaxyGameStyle.mines, "mx-auto w-full max-w-6xl px-3 py-6 sm:px-5 sm:py-9"].join(" ")}>
      <OriginalsNav active="mines"/>
      <header className="mb-6 mt-4"><GameEmblem game="mines"/><h1 className="text-3xl font-bold tracking-tight text-white">Mines</h1><p className="mt-2 text-xs text-slate-500">Reveal safe tiles. Cash out before hitting a mine.</p></header>
      <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-white/[0.07] bg-[#1e1f23] p-5">
          <div className="flex justify-between text-xs"><span className="text-slate-500">Balance</span><span className="font-semibold tabular-nums text-white">{isAuthenticated ? `$${formatCurrency(user?.balance ?? user?.walletBalance ?? 0)}` : "—"}</span></div>
          <label className="mb-2 mt-5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500" htmlFor="mines-amount">Bet amount · USD</label>
          <input id="mines-amount" type="text" inputMode="decimal" value={amount} disabled={controlsDisabled} onChange={(event) => setAmount(event.target.value)} className="h-12 w-full rounded-xl border border-white/10 bg-[#1e1f23] px-3 font-semibold tabular-nums text-white outline-none focus:border-blue-400/50 disabled:opacity-60" />
          <p className="mt-1.5 text-[10px] text-slate-600">Min $0.20 · Max $10,000.00</p><div className="crMineAdjust">{(['half','double'] as const).map(action=><button key={action} type="button" disabled={controlsDisabled} onClick={()=>{const value=Number(amount);if(Number.isFinite(value)&&value>=0){const maximum=Math.min(10000,isAuthenticated?Number(user?.balance??user?.walletBalance??0):10000);setAmount((Math.floor(Math.max(0,Math.min(maximum,action==='half'?value/2:value*2))*100+1e-7)/100).toFixed(2));}}}>{action==='half'?'½':'2×'}</button>)}</div>
          <label className="mb-2 mt-5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500" htmlFor="mines-count">Mines</label>
          <select id="mines-count" value={view.game && active ? view.game.minesCount : mineCount} disabled={controlsDisabled} onChange={(event) => setMineCount(Number(event.target.value))} className="h-11 w-full rounded-xl border border-white/10 bg-[#1e1f23] px-3 text-sm text-white outline-none disabled:opacity-60">{Array.from({ length: 24 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? "mine" : "mines"}</option>)}</select>
          <div className="crMinePresets" role="group" aria-label="Quick mine count">{[1,3,5,10,24].map(count=><button type="button" key={count} disabled={controlsDisabled} aria-pressed={mineCount===count} onClick={()=>setMineCount(count)}>{count}</button>)}</div>
          {!hasHydrated || checking ? <Button isLoading isDisabled className="mt-5 h-12 w-full rounded-xl bg-white/5 text-white">Checking round…</Button>
            : !isAuthenticated ? <Button onPress={() => open("login")} className="mt-5 h-12 w-full rounded-xl mcPrimary font-semibold text-white">Log in to play</Button>
            : view.phase === "unknown" ? <Button onPress={() => { setRound(empty); setMessage(null); }} isDisabled={busy || !roundVerified} className="mt-5 h-12 w-full rounded-xl bg-white/5 text-white">Return to setup</Button>
            : active ? <Button onPress={() => act("cashout")} isLoading={busy && pendingTile == null} isDisabled={busy || !roundVerified || revealed.length === 0} className="mt-5 h-12 w-full rounded-xl bg-emerald-500/20 font-semibold text-emerald-200">Cash out {revealed.length ? `$${formatCurrency(view.game!.currentPayout)}` : ""}</Button>
            : <Button onPress={() => act("start")} isLoading={busy} isDisabled={busy || !roundVerified} className="mt-5 h-12 w-full rounded-xl mcPrimary font-semibold text-white">{busy ? "Starting…" : "Start round"}</Button>}
          {active && revealed.length === 0 && <p className="mt-3 text-center text-[10px] leading-relaxed text-slate-500">Reveal a safe tile to enable cash out.</p>}
          {isAuthenticated && <button type="button" onClick={() => checkRound()} disabled={busy || checking} className="mt-4 w-full py-2 text-xs text-slate-400 hover:text-white disabled:opacity-40">Check current round</button>}
          <p className="mt-4 border-t border-white/[0.06] pt-4 text-[10px] leading-relaxed text-slate-600">Manual play · Your round stays active until it ends or you cash out.</p>
          <button type="button" aria-pressed={soundEnabled} onClick={() => { if (!soundEnabled) unlockAudio(); setSoundEnabled((enabled) => !enabled); }} className="mt-3 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400 outline-none focus-visible:ring-2 focus-visible:ring-blue-300">Sound: {soundEnabled ? "On" : "Off"}</button>
        </aside>

        <section data-phase={view.phase} className="min-w-0 rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#2e2f33] to-[#131418] p-3 sm:p-6" aria-label="Mines game board">
          <div className="mb-5 flex items-center justify-between gap-2"><span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${active ? "bg-blue-400/10 text-blue-200" : view.phase === "won" ? "bg-emerald-400/10 text-emerald-200" : view.phase === "lost" ? "bg-red-400/10 text-red-200" : "bg-white/5 text-slate-400"}`}>{checking ? "Checking round" : active ? "Round active" : view.phase === "won" ? "Cashed out" : view.phase === "lost" ? "Mine hit" : view.phase === "unknown" ? "Check round status" : "Ready to play"}</span><span className="crMineBoardCounts"><span><i className="crMineGemDot"/>{25-mineCount} gems</span><span><i className="crMineBombDot"/>{mineCount} mines</span></span></div>
          <div className="mx-auto grid w-full max-w-[480px] grid-cols-5 gap-2 sm:gap-3">
            {Array.from({ length: 25 }, (_, field) => {
              const hit = view.hit === field;
              const mine = ended && (view.mines.includes(field) || hit);
              const safe = revealed.includes(field) && !mine;
              const otherSafe = ended && !mine && !safe;
              return <button data-tile-state={pendingTile === field ? "pending" : mine ? hit ? "hit" : "mine" : safe ? "safe" : otherSafe ? "unpicked" : "hidden"} key={field} type="button" onClick={() => act("reveal", field)} disabled={!boardEnabled || safe} aria-label={`Tile ${field + 1}${mine ? ", mine" : safe ? ", revealed safe" : ended ? ", not selected" : ", unrevealed"}`} aria-busy={pendingTile === field} className={`relative flex aspect-square min-w-0 items-center justify-center rounded-xl border outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-200 ${mine ? hit ? "border-red-300/50 bg-red-500/20 text-red-300" : "border-red-300/10 bg-red-400/[0.04] text-red-400/40" : safe ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-300" : "border-white/[0.07] bg-[#323337] text-slate-600"} ${boardEnabled && !safe ? "hover:border-blue-300/30 hover:bg-[#4b4c50]" : ""}`}>
                <MinesTileFace state={mine ? "mine" : safe ? "safe" : otherSafe ? "unpicked" : "hidden"} pending={pendingTile === field} hit={hit}/>
              </button>;
            })}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-5 text-center">
            <div><p className="text-[9px] uppercase tracking-widest text-slate-500">Bet</p><p className="mt-2 text-sm font-bold tabular-nums text-white">{view.game ? `$${formatCurrency(view.game.amount)}` : "—"}</p></div>
            <div><p className="text-[9px] uppercase tracking-widest text-slate-500">Multiplier</p><p className="mt-2 text-sm font-bold tabular-nums text-blue-200">{view.game ? `${view.game.multiplier.toFixed(2)}×` : "—"}</p></div>
            <div><p className="text-[9px] uppercase tracking-widest text-slate-500">{ended ? "Payout" : "Current payout"}</p><p className="mt-2 text-sm font-bold tabular-nums text-emerald-200">{view.game ? `$${formatCurrency(view.payout ?? view.game.currentPayout)}` : "—"}</p></div>
          </div>
          <p role="status" className="mt-5 min-h-5 text-center text-xs leading-relaxed text-slate-400">{message || (view.phase === "won" ? `Round complete. Payout: $${formatCurrency(view.payout ?? 0)}.` : view.phase === "lost" ? "This round ended on a mine." : active ? "Choose an unrevealed tile or cash out after a safe reveal." : "Set your bet and mines, then start a round.")}</p>
        </section>
      </div>
    </div>
  );
}
