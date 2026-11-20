"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import OriginalsNav from "@/components/games/OriginalsNav";
import { useReducedMotion } from "framer-motion";
import { useAuthStore } from "@/store/auth.store";
import { useModalStore } from "@/store/modal.store";
import { apiClient } from "@/lib/api/client";
import { emptyRoulette, mergeRouletteBets, placeRouletteBet, readRouletteBets, readRouletteSnapshot, rouletteColor, rouletteColors, isRouletteSpecial, rouletteBetLimit, rouletteError, rouletteNumber, type RouletteColor, type RouletteState } from "@/lib/api/roulette";
import { unlockAudio, playRouletteWin as playBasicWin } from "@/lib/audio";
import galaxyGameStyle from "@/components/games/GamePolish.module.css";
import { RouletteToken } from "@/components/games/GameVisuals";

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const colors = ["border-amber-300/30 bg-amber-400/15 text-amber-200", "border-emerald-300/25 bg-emerald-400/15 text-emerald-200", "border-rose-300/25 bg-rose-400/15 text-rose-200", "border-white/20 bg-white/5 text-white"];
const buttons = ["bg-amber-400 text-[#231b08] hover:bg-amber-300", "bg-emerald-500 text-[#05251b] hover:bg-emerald-400", "bg-rose-500 text-white hover:bg-rose-400", "bg-[#d63345] text-white hover:bg-[#eb4556]"];
// Cosmetic reel order only. The server chooses every winning number.
const order = [0, 8, 5, 10, 6, 9, 7, 11, 2, 14, 3, 13, 4, 12, 1];
const betOrder: RouletteColor[] = [2, 1, 0, 3];

function RouletteIcon({ color, small = false, specialColor }: { color: RouletteColor; small?: boolean; specialColor?: 1 | 2 }) {
  if (color === 3 && specialColor === undefined) return <span className={small ? "crSpecialPair crSpecialPairSmall" : "crSpecialPair"}><RouletteToken color={3} specialColor={2} small={small}/><RouletteToken color={3} specialColor={1} small={small}/></span>;
  return <RouletteToken color={color} small={small} specialColor={specialColor}/>;
}

function RouletteReel({ round, rollTime, sound, specialEnabled, countdown, waiting }: { round: RouletteState["round"]; rollTime: number; sound: boolean; specialEnabled: boolean; countdown: number | null; waiting?: boolean }) {
  const reduced = useReducedMotion();
  const [position, setPosition] = useState(15);
  const [duration, setDuration] = useState(0);
  const [landed, setLanded] = useState(false);
  const [landedResult, setLandedResult] = useState<number | null>(null);
  const lastSpin = useRef<{ id: string; result: number } | null>(null);
  const played = useRef<string | null>(null);
  const soundRef = useRef(sound); soundRef.current = sound;
  const result = round?.result ?? null;
  const id = round?.id;
  const spinAt = round?.spinAt ?? null;
  const rolling = Boolean(round?.rolling);
  useEffect(() => {
    let first = 0, second = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!rolling || result === null || spinAt === null) {
      // Let the completed symbol glow briefly while the next betting round opens.
      const previous = lastSpin.current;
      if (previous) {
        setDuration(0); setPosition(90 + order.indexOf(previous.result));
        setLandedResult(previous.result); setLanded(true);
        if (played.current !== previous.id) { played.current = previous.id; if (soundRef.current) playBasicWin(); }
        timer = setTimeout(() => { setLanded(false); setLandedResult(null); setPosition(15); }, 850);
      } else { setLanded(false); setDuration(0); setPosition(15); }
      return () => { if (timer) clearTimeout(timer); };
    }
    lastSpin.current = { id: id!, result };
    setLanded(false); setLandedResult(result); setDuration(0); setPosition(15);
    const remaining = Math.max(0, rollTime - (Date.now() - spinAt));
    const target = 90 + order.indexOf(result);
    // A completed reconnect snapshot lands immediately rather than replaying an old roll.
    if (remaining <= 0 || reduced) { setPosition(target); setLanded(true); return; }
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const time = Math.max(0, rollTime - (Date.now() - spinAt));
        setDuration(time); setPosition(target);
        timer = setTimeout(() => {
          setLanded(true);
          if (played.current !== id) { played.current = id ?? null; if (soundRef.current) playBasicWin(); }
        }, time);
      });
    });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); if (timer) clearTimeout(timer); };
  }, [id, spinAt, result, rolling, rollTime, reduced]);
  return <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_center,#19223c_0%,#0a101e_70%)] py-14 sm:py-20" data-roulette-reel="true" data-counting={countdown !== null || waiting ? "true" : "false"} aria-label={landed && landedResult !== null ? `Winning number ${landedResult}, ${rouletteColors[rouletteColor(landedResult)].name}` : rolling ? "Roulette rolling" : "Roulette reel"}>
    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#17181c] to-transparent sm:w-24" />
    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#17181c] to-transparent sm:w-24" />
    <div aria-hidden="true" className={`pointer-events-none absolute inset-y-6 left-1/2 z-10 w-[68px] -translate-x-1/2 rounded-2xl border ${landed && landedResult !== null ? `${colors[rouletteColor(landedResult)]} shadow-[0_0_35px_rgba(255,255,255,0.10)]` : "border-white/15 bg-white/[0.025]"}`} />
    <div aria-hidden="true" className="absolute left-1/2 top-0 z-20 -translate-x-1/2 border-x-[7px] border-t-[10px] border-x-transparent border-t-white" />
    <div aria-hidden="true" className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 border-x-[7px] border-b-[10px] border-x-transparent border-b-white" />
    <div aria-hidden="true" className="crRouletteTrack relative left-1/2 flex w-max gap-2 will-change-transform" style={{ transform: `translateX(${-position * 72 - 32}px)`, transition: duration ? `transform ${duration}ms cubic-bezier(.12,.65,.12,1)` : "none" }}>
      {Array.from({ length: 120 }, (_, i) => { const n = order[i % 15]; const special = specialEnabled && isRouletteSpecial(n); return <div key={i} className={`relative flex h-20 w-16 shrink-0 items-center justify-center sm:h-24 ${["text-amber-200 drop-shadow-[0_0_14px_rgba(251,191,36,0.35)]", "text-emerald-300", "text-rose-400"][rouletteColor(n)]}`}><RouletteIcon color={special ? 3 : rouletteColor(n)} specialColor={rouletteColor(n) === 1 ? 1 : 2} /></div>; })}
    </div>
    {(countdown !== null || waiting) && <div className="crReelCountdown" aria-live="off"><span>{waiting ? 'Waiting for round' : countdown! > 0 ? 'Rolling in' : 'Bets closed'}</span><strong>{waiting ? '—' : countdown!.toFixed(1)}</strong></div>}
  </div>;
}

export default function RoulettePage() {
  const { token, hasHydrated, isAuthenticated, user } = useAuthStore();
  const { open } = useModalStore();
  const [game, setGame] = useState<RouletteState>(emptyRoulette);
  const current = useRef(game);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [amount, setAmount] = useState("1.00");
  const [maxMenu, setMaxMenu] = useState(false);
  const [pending, setPending] = useState<RouletteColor | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const lock = useRef(false);
  const session = useRef(0);
  const balanceEpoch = useRef(0);
  const resubscribe = useRef<() => void>(() => {});
  const commit = (next: RouletteState) => { current.current = next; setGame(next); };
  const refreshBalance = async (expectedToken: string | null) => {
    if (!expectedToken) return;
    const epoch = ++balanceEpoch.current;
    try {
      const response = await apiClient.get("/user");
      const balance = Number(response.data?.balance);
      const store = useAuthStore.getState();
      if (balanceEpoch.current === epoch && store.token === expectedToken && Number.isFinite(balance)) store.updateUser({ balance, walletBalance: String(balance) });
    } catch { /* A balance refresh cannot change the round result. */ }
  };

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!hasHydrated) return;
    let alive = true;
    const version = ++session.current;
    balanceEpoch.current += 1; lock.current = false; setPending(null); setMessage(null); setConnected(false); commit(emptyRoulette);
    let cleanup = () => {};
    void import("@/lib/websocket").then(({ websocketManager }) => {
      if (!alive) return;
      let attached: ReturnType<typeof websocketManager.getSocket> = null;
      let detach = () => {};
      let wasConnected = false;
      let waiting: ReturnType<typeof setTimeout> | undefined;
      const clearWait = () => { if (waiting) clearTimeout(waiting); };
      const request = () => {
        if (!attached?.connected) return;
        // Require a fresh snapshot before accepting bets after a reconnect or manual sync.
        commit({ ...current.current, ready: false });
        clearWait();
        waiting = setTimeout(() => { if (alive) setMessage("The round is taking too long to load. Try Sync round."); }, 8000);
        attached.emit("roulette:subscribe");
      };
      resubscribe.current = request;
      const unsubscribe = websocketManager.subscribeStatus((status) => {
        if (!alive) return;
        setConnected(status.connected);
        if (!status.connected) { wasConnected = false; commit({ ...current.current, ready: false }); return; }
        const socket = websocketManager.getSocket();
        if (!socket) return;
        if (socket !== attached) {
          detach(); attached = socket;
          const snapshot = (data: unknown) => {
            if (!alive) return;
            try { const next = readRouletteSnapshot(data); clearWait(); commit(next); void refreshBalance(token); }
            catch { setMessage("Waiting for a valid round. Try Sync round."); }
          };
          const newRound = (data: any) => {
            if (!alive || data?.id == null) return;
            const previous = current.current;
            const id = String(data.id);
            if (previous.round?.id === id) return;
            const result = previous.round?.result;
            commit({ ...previous, round: { id, rolling: Boolean(data.spinning), result: null, spinAt: null }, bets: [],
              last: result != null ? [result, ...previous.last].slice(0, 100) : previous.last,
              deadline: Date.now() + Math.max(0, Number(data.timeLeft) || 0) * 1000,
              // A reconnect still needs its snapshot; a normal new round retains readiness.
              ready: previous.ready });
            setMessage(null); void refreshBalance(token);
          };
          const tick = (seconds: unknown) => {
            const value = Number(seconds); if (!alive || !Number.isFinite(value) || !current.current.round || current.current.round.rolling) return;
            commit({ ...current.current, deadline: Date.now() + Math.max(0, value) * 1000 });
          };
          const spin = (data: any) => {
            if (!alive || !current.current.round || String(data?.id) !== current.current.round.id) return;
            const result = rouletteNumber(data.result ?? data.winningNumber);
            if (result === null) { request(); return; }
            if (current.current.round.rolling && current.current.round.result !== null) return;
            commit({ ...current.current, deadline: 0, round: { ...current.current.round, rolling: true, result, spinAt: Date.now() } });
          };
          const bets = (data: unknown) => { if (alive && current.current.round) commit({ ...current.current, bets: mergeRouletteBets(current.current.bets, readRouletteBets(data)) }); };
          const update = (data: any) => {
            const amount = Number(data?.amount);
            if (alive && Number.isFinite(amount) && amount >= 0) commit({ ...current.current, bets: current.current.bets.map((b) => b.id === String(data?.id) ? { ...b, amount } : b) });
          };
          socket.on("roulette:set", snapshot); socket.on("roulette:new", newRound); socket.on("roulette:tick", tick); socket.on("roulette:spin", spin); socket.on("roulette:bets", bets); socket.on("roulette:bet:update", update);
          detach = () => { socket.off("roulette:set", snapshot); socket.off("roulette:new", newRound); socket.off("roulette:tick", tick); socket.off("roulette:spin", spin); socket.off("roulette:bets", bets); socket.off("roulette:bet:update", update); };
        }
        if (!wasConnected) { wasConnected = true; request(); }
      });
      const onVisible = () => { if (document.visibilityState === "visible") request(); };
      document.addEventListener("visibilitychange", onVisible);
      cleanup = () => { clearWait(); unsubscribe(); detach(); if (attached?.connected) attached.emit("roulette:unsubscribe"); document.removeEventListener("visibilitychange", onVisible); };
      websocketManager.connect(token ?? undefined);
    }).catch(() => { if (alive) setMessage("Could not connect to Roulette. Try Sync round."); });
    return () => { alive = false; if (session.current === version) session.current += 1; balanceEpoch.current += 1; resubscribe.current = () => {}; cleanup(); };
    // The connection is scoped to the current account and all exact listeners are removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated, token, refresh]);

  const seconds = Math.max(0, (game.deadline - now) / 1000);
  const accepting = connected && game.ready && !!game.round && !game.round.rolling && seconds >= 1;
  const myId = user?.id == null ? null : String(user.id);
  const myBets = game.bets.filter((b) => b.user.id === myId);
  const total = game.bets.reduce((sum, b) => sum + b.amount, 0);
  const spinFinished = Boolean(game.round?.rolling && game.round.spinAt !== null && now >= (game.round?.spinAt ?? now) + game.rollTime);
  const result = game.round?.result ?? null;

  const adjustAmount = (action: "half" | "double" | RouletteColor) => {
    if (pending !== null) return;
    const balance = Number(user?.balance ?? user?.walletBalance ?? 0);
    const available = isAuthenticated && Number.isFinite(balance) ? Math.max(0, balance) : game.maxBet;
    const value = Number(amount);
    let next: number;
    if (typeof action === "number") {
      const alreadyBet = myBets.reduce((sum, b) => sum + b.amount, 0);
      next = Math.min(available, Math.max(0, rouletteBetLimit(game, action) - alreadyBet));
      setMaxMenu(false);
    } else {
      if (!Number.isFinite(value) || value < 0) { setMessage("Enter a valid bet amount first."); return; }
      next = Math.min(available, Math.max(0,game.maxBet-myBets.reduce((sum,b)=>sum+b.amount,0)), Math.max(0.2, action === "half" ? value / 2 : value * 2));
    }
    // Floor to cents so an adjustment never exceeds the available balance or limit.
    next = Math.floor(Number((next * 100).toPrecision(12))) / 100;
    setAmount(next.toFixed(2));
    setMessage(next < 0.2 ? "At least $0.20 of balance and remaining round limit is needed to bet." : null);
  };

  const bet = async (color: RouletteColor) => {
    if (lock.current) return;
    if (!isAuthenticated || !token) { open("login"); return; }
    if (!current.current.ready || !connected || current.current.round?.rolling || current.current.deadline - Date.now() < 1000) { setMessage("Betting is closed. Wait for the next round."); return; }
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) < 0.2) { setMessage("Enter at least $0.20, with up to two decimal places."); return; }
    if (color === 3 && !current.current.sideBetEnabled) { setMessage("The special 7× bet is not available on this server yet."); return; }
    const cap = rouletteBetLimit(current.current, color);
    if (Number(amount)+myBets.reduce((sum,b)=>sum+b.amount,0)>game.maxBet) {setMessage("Your total Roulette stake cannot exceed $10,000 per round.");return;}
    if (Number(amount) > cap) { setMessage(`The limit for ${rouletteColors[color].name.toLowerCase()} is $${money(cap)}.`); return; }
    if (sound) unlockAudio();
    const version = session.current;
    lock.current = true; setPending(color); setMessage(null);
    try {
      await placeRouletteBet(Number(amount), color);
      if (version !== session.current) return;
      setMessage("Bet accepted. Your live bets are listed below.");
      resubscribe.current();
    } catch (error) {
      if (version !== session.current) return;
      setMessage(rouletteError(error));
      // A missing HTTP response may still mean a committed bet. Read the socket snapshot; never retry the POST.
      resubscribe.current();
    } finally {
      if (version === session.current) { lock.current = false; setPending(null); void refreshBalance(token); }
    }
  };

  const balance = Math.max(0, Number(user?.balance ?? user?.walletBalance ?? 0));
  const selectedTotal = myBets.reduce((sum, b) => sum + b.amount, 0);
  const winningComet = game.sideBetEnabled && result !== null && isRouletteSpecial(result);
  const recent = game.last.slice(0, 20);

  return <main className={[galaxyGameStyle.roulette, "mx-auto w-full max-w-6xl px-3 py-6 sm:px-5 sm:py-9"].join(" ")}>
    <OriginalsNav active="roulette"/>
    <header className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3"><div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-300/15 bg-violet-400/10 text-violet-200"><RouletteIcon color={3} small /></div><div><p className="mb-1 text-[9px] font-semibold uppercase tracking-[.22em] text-violet-300/70">GalaxyBets Original</p><h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Roulette</h1></div></div>
      <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] font-semibold ${connected ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300" : "border-white/10 bg-white/5 text-slate-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-300" : "bg-slate-500"}`} />{connected ? "Live round" : "Connecting…"}</span>
    </header>

    <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1e1f23] shadow-[0_15px_70px_rgba(0,0,0,.2)]" aria-label="Live Roulette round">
      <div className="flex min-h-24 items-center justify-between gap-3 px-4 py-5 sm:px-6"><div><p className="text-[9px] font-semibold uppercase tracking-[.18em] text-slate-500">{game.round ? `Round #${game.round.id}` : "Live round"}</p><p role="status" className="mt-2 text-lg font-semibold text-white">{!connected ? "Connecting to Roulette…" : !game.ready ? "Syncing round…" : game.round?.rolling ? spinFinished && result !== null ? `${rouletteColors[rouletteColor(result)].name}${winningComet ? " + Special 7×" : ""} wins` : "Rolling…" : seconds >= 1 ? "Place your bets" : "Bets closed"}</p></div><div className="text-right"><p className="font-mono text-2xl font-bold tabular-nums text-white">{game.ready && !game.round?.rolling ? `${seconds.toFixed(1)}s` : game.round?.rolling ? "Rolling" : "—"}</p><p className="mt-1 text-[9px] uppercase tracking-widest text-slate-500">{game.round?.rolling ? "Next round follows" : "Until roll"}</p></div></div>
      <div className="h-[3px] overflow-hidden bg-white/5"><div className="h-full rounded-r-full bg-gradient-to-r from-blue-500 to-violet-400 transition-[width] duration-100" style={{ width: `${game.round?.rolling || !game.ready ? 0 : Math.min(100, seconds * 1000 / game.betTime * 100)}%` }} /></div>
      <RouletteReel round={game.round} rollTime={game.rollTime} sound={sound} specialEnabled={game.sideBetEnabled} countdown={connected && game.ready && !game.round?.rolling ? seconds : null} waiting={!connected || !game.ready} />
      <div className="border-t border-white/[0.05] bg-[#16171b] p-3 sm:px-5 sm:py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><span className="mr-1 shrink-0 text-[9px] uppercase tracking-widest text-slate-500">Last rolls</span><div className="flex min-w-0 gap-1.5 overflow-x-auto pb-1">{game.last.length ? game.last.slice(0, 16).map((n, i) => <span key={`${i}-${n}`} title={`${rouletteColors[rouletteColor(n)].name}${game.sideBetEnabled && isRouletteSpecial(n) ? " + Special 7×" : ""}`} aria-label={`${rouletteColors[rouletteColor(n)].name}${game.sideBetEnabled && isRouletteSpecial(n) ? " and Special 7×" : ""}`} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${colors[rouletteColor(n)]}`}><RouletteIcon color={game.sideBetEnabled && isRouletteSpecial(n) ? 3 : rouletteColor(n)} specialColor={rouletteColor(n) === 1 ? 1 : 2} small /></span>) : <span className="text-xs text-slate-600">Waiting for results</span>}</div></div><span className="shrink-0 text-[9px] text-slate-500">Newest first</span></div></div>
    </section>

    <section className="mt-4 rounded-2xl border border-white/[0.07] bg-[#1e1f23] p-4 sm:p-5" aria-label="Place Roulette bet">
      <p className="mb-3 text-[10px] text-slate-500">Maximum total stake: $10,000 per player per round.</p><div className="flex flex-wrap items-end justify-between gap-4"><div className="w-full sm:max-w-lg"><label htmlFor="roulette-amount" className="mb-2 block text-[9px] font-semibold uppercase tracking-widest text-slate-500">Bet amount · USD</label><div className="flex min-w-0 gap-2"><input id="roulette-amount" inputMode="decimal" value={amount} disabled={pending !== null} onChange={(e) => setAmount(e.target.value)} className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#121317] px-3 font-semibold tabular-nums text-white outline-none focus:border-violet-300/60 disabled:opacity-50" /><div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-[#121317] p-1"><button type="button" aria-label="Halve bet amount" disabled={pending !== null} onClick={() => adjustAmount("half")} className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-40">½</button><button type="button" aria-label="Double bet amount" disabled={pending !== null} onClick={() => adjustAmount("double")} className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-40">2×</button><button type="button" aria-expanded={maxMenu} aria-controls="roulette-max-options" disabled={pending !== null || !isAuthenticated} onClick={() => setMaxMenu((value) => !value)} className="h-9 rounded-lg bg-violet-400/10 px-2.5 text-xs font-semibold text-violet-200 hover:bg-violet-400/20 focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-40">Max</button></div></div>
        {maxMenu && <div id="roulette-max-options" className="mt-2 rounded-xl border border-white/10 bg-[#121317] p-3"><p className="mb-2 text-[10px] text-slate-500">Fill the maximum for your chosen bet.</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{betOrder.map((c) => { const used = myBets.filter((b) => b.color === c).reduce((sum, b) => sum + b.amount, 0); const max = Math.min(balance, Math.max(0, rouletteBetLimit(game, c) - used)); return <button key={c} type="button" onClick={() => adjustAmount(c)} disabled={pending !== null || (c === 3 && !game.sideBetEnabled)} className={`rounded-lg border px-2 py-2 text-xs disabled:opacity-40 ${colors[c]}`}><span className="block font-semibold">{rouletteColors[c].name}</span><span className="mt-1 block text-[10px]">${money(Math.floor(Number((max * 100).toPrecision(12))) / 100)}</span></button>; })}</div></div>}
        <p className="mt-2 text-[10px] text-slate-500">Minimum $0.20 · Each accepted bet adds to your total</p></div><div className="flex gap-6 text-right"><div><p className="text-[9px] uppercase tracking-widest text-slate-500">This round</p><p className="mt-2 font-semibold tabular-nums text-violet-200">${money(selectedTotal)}</p></div><div><p className="text-[9px] uppercase tracking-widest text-slate-500">Balance</p><p className="mt-2 font-semibold tabular-nums text-white">{isAuthenticated ? `$${money(balance)}` : "—"}</p></div></div></div>
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{betOrder.map((c) => { const color = rouletteColors[c]; const mine = myBets.filter((b) => b.color === c).reduce((sum, b) => sum + b.amount, 0); const opposite = (c === 1 || c === 2) && myBets.some((b) => b.color === (c === 1 ? 2 : 1)); const unavailable = c === 3 && !game.sideBetEnabled; return <div key={c} className={`relative overflow-hidden rounded-xl border p-3 sm:p-4 ${colors[c]}`}><div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div><div className="mb-2"><RouletteIcon color={c} small /></div><p className="text-xs font-semibold">{color.name}</p></div><p className="text-xl font-bold tracking-tight sm:text-2xl">{color.multiplier}<span className="ml-0.5 text-sm opacity-60">×</span></p></div><button type="button" onClick={() => bet(c)} disabled={!hasHydrated || unavailable || pending !== null || (isAuthenticated && (!accepting || opposite))} className={`h-11 w-full rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-35 ${buttons[c]}`}>{pending === c ? "Placing…" : unavailable ? "Unavailable" : !isAuthenticated ? "Log in to bet" : opposite ? "Other color selected" : `Play ${color.multiplier}×`}</button><div className="mt-3 flex flex-col gap-1 text-[9px] opacity-70 sm:flex-row sm:justify-between"><span>Your bet ${money(mine)}</span><span>Limit ${money(rouletteBetLimit(game, c))}</span></div></div>; })}</div>
      <p role="status" className="mt-4 min-h-5 text-xs leading-relaxed text-slate-400">{message || (game.sideBetEnabled ? "The red and green 7× symbols pay 7× and also count toward their green or red color. Multipliers include your stake." : "Green or red, plus optional gold. Multipliers include your stake.")}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4"><div className="flex items-center gap-2"><button type="button" aria-pressed={sound} onClick={() => { if (!sound) unlockAudio(); setSound(!sound); }} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] text-slate-400 hover:text-white">Sound: {sound ? "On" : "Off"}</button><details className="relative text-[10px] text-slate-400"><summary className="cursor-pointer rounded-lg px-2 py-2 hover:text-white">How to play</summary><div className="absolute bottom-full left-0 z-30 mb-3 w-60 rounded-xl border border-white/10 bg-[#494a4e] p-4 text-xs leading-relaxed shadow-xl">Choose green or red, and optionally add gold or special 7×. Bets close before the roll. A special 7× symbol is one of two special positions; its green or red color still wins too. All payouts are settled by the server.</div></details></div><button type="button" disabled={pending !== null} onClick={() => setRefresh((n) => n + 1)} className="rounded-lg px-3 py-2 text-[10px] text-violet-300 hover:text-white disabled:opacity-40">Sync round ↻</button></div>
    </section>

    <div className="mb-3 mt-7 flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-500"><span className="font-semibold uppercase tracking-widest">Live bets · {game.bets.length}</span><span className="tabular-nums">Total ${money(total)}</span></div>
    <section className="grid grid-cols-2 items-start gap-3 lg:grid-cols-4" aria-label="Live bets by color">{betOrder.map((c) => { const color = rouletteColors[c]; const bets = game.bets.filter((b) => b.color === c).sort((a, b) => b.amount - a.amount); return <div key={c} className="min-w-0 overflow-hidden rounded-xl border border-white/[0.07] bg-[#16171b]"><div className={`flex flex-wrap items-center justify-between gap-2 border-b p-3 text-[10px] ${colors[c]}`}><span className="inline-flex items-center gap-2 font-semibold"><RouletteIcon color={c} small />{color.name} · {bets.length}</span><span className="font-bold tabular-nums">${money(bets.reduce((sum, b) => sum + b.amount, 0))}</span></div><div className="max-h-64 overflow-y-auto p-2">{bets.length ? bets.map((b) => <div key={b.id} className={`mb-1 flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-[10px] ${b.user.id === myId ? "bg-violet-400/10 text-violet-200" : "text-slate-400"}`}><span className="min-w-0 truncate">{b.user.username}{b.user.id === myId ? " (you)" : ""}</span><span className="shrink-0 font-semibold tabular-nums">${money(b.amount)}</span></div>) : <div className="py-7 text-center"><p className="text-[10px] text-slate-600">No bets yet</p><p className="mt-1 text-[9px] text-slate-700">{color.multiplier}× return</p></div>}</div></div>; })}</section>
    {recent.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.05] bg-[#16171b] px-4 py-3"><span className="text-[9px] uppercase tracking-widest text-slate-600">Last {recent.length}</span>{betOrder.filter((c) => c !== 3 || game.sideBetEnabled).map((c) => <span key={c} title={rouletteColors[c].name} className={`inline-flex items-center gap-2 text-xs ${["text-amber-200", "text-emerald-300", "text-rose-300", "text-violet-300"][c]}`}><RouletteIcon color={c} small /><span className="font-semibold tabular-nums">{recent.filter((n) => c === 3 ? isRouletteSpecial(n) : rouletteColor(n) === c).length}</span></span>)}</div>}
  </main>;
}
