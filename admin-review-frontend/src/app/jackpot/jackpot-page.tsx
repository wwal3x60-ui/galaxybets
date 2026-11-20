"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, Input } from "@heroui/react";
import { useReducedMotion } from "framer-motion";
import { useAuthStore } from "@/store/auth.store";
import { useModalStore } from "@/store/modal.store";
import { apiClient } from "@/lib/api/client";
import { initialJackpotConfig, jackpotColor, jackpotError, jackpotPlayers, joinJackpot, readJackpotBets, readJackpotRoll, readJackpotSnapshot, type JackpotBet, type JackpotConfig, type JackpotPlayer, type JackpotRoll, type JackpotRound, type JackpotSnapshot, type JackpotUser } from "@/lib/api/jackpot";
import type { JackpotSocketHandlers } from "@/lib/websocket";
import { unlockAudio, playSpecialWin } from "@/lib/audio";

type Spin = { key: string; players: JackpotPlayer[]; winner: JackpotPlayer; roll: JackpotRoll; pot: number; chance: number; duration: number; startedAt: number };
type Live = { round: JackpotRound | null; bets: JackpotBet[]; config: JackpotConfig; seconds: number | null; ready: boolean; spin: Spin | null };
const empty: Live = { round: null, bets: [], config: initialJackpotConfig, seconds: null, ready: false, spin: null };
const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function PlayerAvatar({ user, color, large = false }: { user: JackpotUser; color: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = large ? "h-12 w-12 text-lg" : "h-9 w-9 text-sm";
  return <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-[#38393d] font-bold text-white ${size}`} style={{ borderColor: color }}>
    {!user.anon && !failed ? <img src={`/api/v1/user/${encodeURIComponent(user.id)}/img`} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} /> : <span>{user.anon ? "?" : user.username.slice(0, 1).toUpperCase()}</span>}
  </span>;
}

function JackpotWheel({ players, spin, pot, seconds, closed, ready, sound, onFinish }: { players: JackpotPlayer[]; spin: Spin | null; pot: number; seconds: number | null; closed: boolean; ready: boolean; sound: boolean; onFinish: (spin: Spin) => void }) {
  const reduced = useReducedMotion();
  const [rotation, setRotation] = useState(0);
  const [duration, setDuration] = useState(0);
  const [landed, setLanded] = useState(false);
  const soundRef = useRef(sound); soundRef.current = sound;
  const finishRef = useRef(onFinish); finishRef.current = onFinish;
  const displayed = spin?.players ?? players;
  const segments = useMemo(() => {
    let start = 0;
    return displayed.map((p) => { const value = { ...p, start, end: start + p.chance * 3.6, middle: start + p.chance * 1.8 }; start = value.end; return value; });
  }, [displayed]);
  const gradient = segments.length ? `conic-gradient(${segments.map((p) => `${p.color} ${p.start}deg ${p.end}deg`).join(", ")})` : "conic-gradient(#434448 0deg 90deg,#35363a 90deg 180deg,#434448 180deg 270deg,#35363a 270deg 360deg)";

  useEffect(() => {
    let first = 0, second = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setRotation(0); setDuration(0); setLanded(false);
    if (!spin) return;
    let before = 0;
    for (const p of spin.players) { if (p.user.id === spin.winner.user.id) break; before += p.chance * 3.6; }
    const middle = before + spin.winner.chance * 1.8;
    const target = 360 * 6 + ((360 - middle) % 360);
    const finish = () => { setLanded(true); if (soundRef.current) playSpecialWin(); finishRef.current(spin); };
    // Local time is used ONLY to finish/resume this visual animation, never the betting countdown.
    const remaining = Math.max(0, spin.duration - (Date.now() - spin.startedAt));
    if (reduced || remaining === 0) { setRotation(target); finish(); return; }
    first = requestAnimationFrame(() => { second = requestAnimationFrame(() => {
      const ms = Math.max(0, spin.duration - (Date.now() - spin.startedAt));
      setDuration(ms); setRotation(target); timer = setTimeout(finish, ms);
    }); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); if (timer) clearTimeout(timer); };
  }, [spin?.key, reduced]);

  return <div className="relative mx-auto w-full max-w-[410px] p-5 sm:p-7" aria-label={spin ? `Spinning to the server-selected winner, ${spin.winner.user.username}` : "Jackpot wheel"}>
    <div className={`pointer-events-none absolute inset-5 rounded-full blur-2xl transition-opacity ${spin ? "opacity-30" : "opacity-10"}`} style={{ background: spin?.winner.color || "#eb808b" }} />
    <div className="relative aspect-square rounded-full border border-white/10 bg-[#121317] p-2 shadow-[0_0_0_7px_rgba(255,255,255,.025)] sm:p-3">
      <div aria-hidden="true" className="absolute -top-2 left-1/2 z-20 -translate-x-1/2 border-x-[10px] border-t-[19px] border-x-transparent border-t-white drop-shadow-lg" />
      <div aria-hidden="true" className="absolute inset-2 overflow-hidden rounded-full sm:inset-3" style={{ background: gradient, transform: `rotate(${rotation}deg)`, transition: duration ? `transform ${duration}ms cubic-bezier(.12,.68,.12,1)` : "none" }}>
        {segments.filter((p) => p.chance >= 4).map((p) => { const angle = p.middle * Math.PI / 180; return <span key={p.user.id} className="absolute rounded-full bg-[#121317]/80 p-0.5" style={{ left: `${50 + Math.sin(angle) * 40}%`, top: `${50 - Math.cos(angle) * 40}%`, transform: `translate(-50%,-50%) rotate(${-rotation}deg)`, transition: duration ? `transform ${duration}ms cubic-bezier(.12,.68,.12,1)` : "none" }}><PlayerAvatar user={p.user} color={p.color} /></span>; })}
      </div>
      <div className={`absolute inset-[21%] z-10 flex flex-col items-center justify-center rounded-full border bg-[#16171b] px-3 text-center shadow-[0_0_30px_rgba(0,0,0,.4)] ${landed ? "border-amber-200/50" : "border-white/10"}`}>
        <span className="text-[8px] font-semibold uppercase tracking-[.2em] text-slate-500 sm:text-[10px]">{spin ? "Round pot" : "Jackpot"}</span>
        <span className="mt-2 max-w-full break-all text-xl font-bold tracking-tight text-white sm:text-3xl">${money(spin?.pot ?? pot)}</span>
        <span className={`mt-3 rounded-full px-2 py-1 text-[9px] font-semibold sm:text-xs ${spin ? "bg-violet-400/10 text-violet-200" : "bg-white/5 text-slate-400"}`}>{spin ? "Spinning…" : !ready ? "Syncing…" : closed ? "Awaiting result" : seconds == null ? "Awaiting server tick" : `${seconds}s remaining`}</span>
      </div>
    </div>
  </div>;
}

export default function JackpotPage() {
  const { token, hasHydrated, isAuthenticated, user } = useAuthStore();
  const { open } = useModalStore();
  const [game, setGame] = useState<Live>(empty);
  const live = useRef(game);
  const [connected, setConnected] = useState(false);
  const [amount, setAmount] = useState("1.00");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const [lastWinner, setLastWinner] = useState<Spin | null>(null);
  const lock = useRef(false);
  const session = useRef(0);
  const balanceEpoch = useRef(0);
  const handledRolls = useRef(new Set<string>());
  const resync = useRef<() => void>(() => {});
  const commit = (value: Live) => { live.current = value; setGame(value); };
  const refreshBalance = async (expectedToken: string | null) => {
    if (!expectedToken) return;
    const epoch = ++balanceEpoch.current;
    try { const response = await apiClient.get("/user"); const balance = Number(response.data?.balance); const store = useAuthStore.getState(); if (balanceEpoch.current === epoch && store.token === expectedToken && Number.isFinite(balance)) store.updateUser({ balance, walletBalance: String(balance) }); } catch { /* Balance reads do not affect game outcomes. */ }
  };

  const installRoll = (roll: JackpotRoll, duration: number) => {
    const current = live.current;
    if (!current.round || roll.roundId !== current.round.id) return;
    const key = `${roll.roundId}:${roll.winnerBetId}`;
    if (handledRolls.current.has(key)) return;
    const winningBet = current.bets.find((b) => b.id === roll.winnerBetId);
    if (!winningBet) throw new Error("The winning entry has not arrived yet. Sync the round.");
    const players = jackpotPlayers(current.bets);
    const winner = players.find((p) => p.user.id === winningBet.user.id);
    if (!winner || (roll.winner && roll.winner.user.id !== winner.user.id)) throw new Error("Could not match the server winner. Sync the round.");
    handledRolls.current.add(key);
    if (handledRolls.current.size > 30) handledRolls.current.delete(handledRolls.current.values().next().value!);
    const spin: Spin = { key, players, winner: roll.winner ? { ...winner, user: roll.winner.user } : winner, roll, pot: roll.winner?.totalAmount ?? current.round.amount, chance: roll.winner?.chance ?? winner.chance, duration, startedAt: Date.now() };
    commit({ ...current, round: { ...current.round, closed: true, winnerBet: roll.winnerBetId, ticket: roll.ticket, serverSeed: roll.serverSeed, clientSeed: roll.clientSeed }, spin });
  };

  useEffect(() => {
    if (!hasHydrated) return;
    let alive = true;
    const version = ++session.current;
    balanceEpoch.current += 1; lock.current = false; handledRolls.current.clear();
    commit(empty); setConnected(false); setBusy(false); setMessage(null); setLastWinner(null);
    let unsubscribe = () => {};
    void import("@/lib/websocket").then(({ subscribeJackpot }) => {
      if (!alive) return;
      const guarded = (fn: () => void) => { if (!alive) return; try { fn(); } catch (error) { commit({ ...live.current, ready: false }); setMessage(jackpotError(error)); } };
      const snapshot = (raw: unknown) => guarded(() => {
        const data: JackpotSnapshot = readJackpotSnapshot(raw);
        commit({ ...live.current, round: data.round, bets: data.bets, config: data.config, ready: true });
        // A reconnect snapshot can recover the already selected winner. This only resumes
        // its animation; it never recreates the result or changes the countdown.
        if (data.round.winnerBet && data.round.ticket !== null) {
          const roll = readJackpotRoll(data.round.id, data.round.serverSeed, data.round.clientSeed, data.round.winnerBet, data.round.ticket);
          const serverNow = Date.parse(data.serverTime || ""); const rolledAt = Date.parse(data.round.rolledAt || "");
          const remaining = Number.isFinite(serverNow) && Number.isFinite(rolledAt) ? Math.max(0, data.config.rollTime - Math.max(0, serverNow - rolledAt)) : 0;
          installRoll(roll, remaining);
        }
      });
      const handlers: JackpotSocketHandlers = {
        onConnection: (value) => { if (!alive) return; setConnected(value); if (!value) commit({ ...live.current, ready: false, seconds: null }); },
        onSync: () => { if (alive) commit({ ...live.current, ready: false, seconds: null }); },
        onSet: snapshot,
        onTick: (raw) => guarded(() => {
          if (raw == null || raw === "" || !Number.isFinite(Number(raw)) || Number(raw) < 0) throw new Error("Invalid server tick. Sync the round.");
          const seconds = Math.ceil(Number(raw));
          const round = live.current.round;
          commit({ ...live.current, seconds, round: round && seconds === 0 ? { ...round, closed: true } : round });
        }),
        onBets: (raw) => guarded(() => { const bets = readJackpotBets(raw); commit({ ...live.current, bets }); }),
        onAmount: (raw) => guarded(() => { const value = Number(raw); if (raw == null || !Number.isFinite(value) || value < 0) throw new Error("Invalid server pot. Sync the round."); if (live.current.round) commit({ ...live.current, round: { ...live.current.round, amount: value } }); }),
        onCommit: (block) => guarded(() => { if (live.current.round) commit({ ...live.current, round: { ...live.current.round, closed: true, EOSBlock: String(block) } }); }),
        onRoll: (...args) => guarded(() => { const roll = readJackpotRoll(args[0], args[1], args[2], args[3], args[4], args[5]); installRoll(roll, live.current.config.rollTime); }),
        onReset: () => { if (!alive) return; commit({ ...empty, config: live.current.config, spin: live.current.spin }); void refreshBalance(token); },
        onNewRound: (raw) => guarded(() => {
          const value = raw as Record<string, unknown>;
          if (value?.id == null || String(value.id) === live.current.round?.id) return;
          const data = readJackpotSnapshot({ round: value, bets: [], config: value.config ?? live.current.config, spinning: value.spinning });
          commit({ ...live.current, round: data.round, bets: [], config: data.config, seconds: null, ready: true });
          setMessage(null); void refreshBalance(token);
        }),
      };
      const control = subscribeJackpot(handlers, token ?? undefined);
      resync.current = control.resync; unsubscribe = control.unsubscribe;
      const visible = () => { if (document.visibilityState === "visible") control.resync(); };
      document.addEventListener("visibilitychange", visible);
      const release = unsubscribe;
      unsubscribe = () => { document.removeEventListener("visibilitychange", visible); release(); };
      if (version !== session.current) unsubscribe();
    }).catch(() => { if (alive) setMessage("Could not connect to Jackpot. Refresh the page to retry."); });
    return () => { alive = false; session.current += 1; balanceEpoch.current += 1; resync.current = () => {}; unsubscribe(); };
    // Socket callbacks are recreated for each authenticated session and removed exactly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasHydrated]);

  const players = useMemo(() => jackpotPlayers(game.bets), [game.bets]);
  const myId = user?.id == null ? null : String(user.id);
  const own = players.find((p) => p.user.id === myId);
  const balance = Math.max(0, Number(user?.balance ?? user?.walletBalance ?? 0));
  const remainingLimit = Math.max(0, game.config.maxBet - (own?.amount ?? 0));
  const maximum = Math.floor(Number((Math.min(balance, remainingLimit) * 100).toPrecision(12))) / 100;
  const accepting = connected && game.ready && game.round && !game.round.closed && game.seconds !== null && game.seconds > 0;
  const finishSpin = (spin: Spin) => {
    if (live.current.spin?.key !== spin.key) return;
    setLastWinner(spin); commit({ ...live.current, spin: null });
  };
  const adjust = (action: "half" | "double" | "max") => {
    if (busy) return;
    const value = Number(amount);
    if (action !== "max" && (!Number.isFinite(value) || value < 0)) return;
    const next = action === "max" ? maximum : Math.min(isAuthenticated ? maximum : game.config.maxBet, Math.max(game.config.minBet, action === "half" ? value / 2 : value * 2));
    setAmount((Math.floor(Number((next * 100).toPrecision(12))) / 100).toFixed(2));
  };
  const placeBet = async () => {
    if (lock.current) return;
    if (!isAuthenticated || !token) { open("login"); return; }
    const current = live.current;
    if (!connected || !current.ready || !current.round || current.round.closed || current.seconds == null || current.seconds <= 0) { setMessage("Betting is closed or syncing. Wait for the next server tick."); return; }
    const currentOwn = jackpotPlayers(current.bets).find((p) => p.user.id === String(useAuthStore.getState().user?.id));
    if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) < current.config.minBet || Number(amount) + (currentOwn?.amount ?? 0) > current.config.maxBet) { setMessage(`Enter at least $${money(current.config.minBet)}. Your total stake cannot exceed $${money(current.config.maxBet)}.`); return; }
    if (sound) unlockAudio();
    lock.current = true; setBusy(true); setMessage(null);
    const version = session.current;
    try { await joinJackpot(Number(amount)); if (version === session.current) { setMessage("Entry accepted. Your stake updates from the server."); resync.current(); } }
    catch (error) { if (version === session.current) { setMessage(jackpotError(error)); resync.current(); } }
    finally { if (version === session.current) { lock.current = false; setBusy(false); void refreshBalance(token); } }
  };

  return <main className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-5 sm:py-9">
    <Link href="/" className="text-xs text-slate-500 hover:text-white">← Home</Link>
    <header className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-3"><div><p className="mb-1 text-[9px] font-semibold uppercase tracking-[.2em] text-violet-300/70">One pot. One winner.</p><h1 className="text-3xl font-bold tracking-tight text-white">Jackpot</h1></div><span className={`rounded-full border px-3 py-2 text-[10px] font-semibold ${connected ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-300" : "border-white/10 text-slate-500"}`}>{connected ? "Live" : "Connecting…"}</span></header>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1e1f23]" aria-label="Live Jackpot">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-6"><div><p className="text-[9px] uppercase tracking-widest text-slate-500">{game.round ? `Round #${game.round.id}` : "Live round"}</p><p role="status" className="mt-1.5 text-sm font-semibold text-white">{!connected ? "Connecting to the server…" : !game.ready ? "Syncing round…" : game.spin ? "Spinning the wheel…" : game.round?.closed ? "Waiting for the server result…" : "Entries are open"}</p></div><div className="text-right"><p className="font-mono text-2xl font-bold tabular-nums text-white">{game.seconds == null ? "—" : `${game.seconds}s`}</p><p className="text-[9px] text-slate-500">Server countdown</p></div></div>
        <div className="h-1 bg-white/5"><div className="h-full bg-gradient-to-r from-blue-500 to-violet-400" style={{ width: `${game.seconds == null ? 0 : Math.max(0, Math.min(100, game.seconds / (game.config.betTime / 1000) * 100))}%` }} /></div>
        <div className="bg-[radial-gradient(ellipse_at_center,#19223c_0%,#0b1221_75%)] p-3 sm:p-5"><JackpotWheel players={players} spin={game.spin} pot={game.round?.amount ?? 0} seconds={game.seconds} closed={Boolean(game.round?.closed)} ready={game.ready} sound={sound} onFinish={finishSpin} /></div>
        <div className="grid grid-cols-3 border-t border-white/[0.06] bg-[#16171b] py-4 text-center"><div><p className="text-[9px] uppercase tracking-widest text-slate-500">Pot</p><p className="mt-2 text-sm font-bold tabular-nums text-white">${money(game.round?.amount ?? 0)}</p></div><div><p className="text-[9px] uppercase tracking-widest text-slate-500">Players</p><p className="mt-2 text-sm font-bold text-white">{players.length}</p></div><div><p className="text-[9px] uppercase tracking-widest text-slate-500">Your chance</p><p className="mt-2 text-sm font-bold tabular-nums text-violet-200">{(own?.chance ?? 0).toFixed(2)}%</p></div></div>
      </section>

      <aside className="rounded-2xl border border-white/[0.07] bg-[#1e1f23] p-5">
        <div className="flex justify-between text-xs"><span className="text-slate-500">Balance</span><span className="font-semibold tabular-nums text-white">{isAuthenticated ? `$${money(balance)}` : "—"}</span></div>
        <Input label="Bet amount · USD" labelPlacement="outside" aria-label="Jackpot bet amount in dollars" inputMode="decimal" value={amount} onValueChange={setAmount} isDisabled={busy} className="mt-6" classNames={{ label: "text-xs text-slate-500", input: "font-semibold tabular-nums text-white", inputWrapper: "border border-white/10 bg-[#121317]" }} />
        <div className="mt-3 grid grid-cols-3 gap-2">{(["half", "double", "max"] as const).map((action) => <Button key={action} size="sm" variant="flat" isDisabled={busy || (action === "max" && !isAuthenticated)} onPress={() => adjust(action)} className="h-9 min-w-0 rounded-lg bg-white/5 text-xs text-slate-300">{action === "half" ? "½" : action === "double" ? "2×" : "Max"}</Button>)}</div>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500">Min ${money(game.config.minBet)} · Total limit ${money(game.config.maxBet)}</p>
        <Button onPress={placeBet} isLoading={busy} isDisabled={!hasHydrated || busy || (isAuthenticated && !accepting)} className="mt-5 h-12 w-full rounded-xl mcPrimary font-semibold text-white">{!isAuthenticated ? "Log in to join" : busy ? "Joining…" : !accepting ? "Waiting for round" : own ? "Add to your entry" : "Join Jackpot"}</Button>
        <div className="mt-5 rounded-xl border border-white/[0.06] bg-[#16171b] p-4"><div className="flex justify-between text-xs text-slate-500"><span>Your stake</span><span className="font-semibold tabular-nums text-white">${money(own?.amount ?? 0)}</span></div><div className="mt-3 flex justify-between text-xs text-slate-500"><span>Your chance</span><span className="font-semibold tabular-nums text-violet-200">{(own?.chance ?? 0).toFixed(2)}%</span></div></div>
        <p role="status" className="mt-4 min-h-8 text-xs leading-relaxed text-slate-400">{message || "Entries, pot size and the countdown update live from the server."}</p>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-4"><button type="button" aria-pressed={sound} onClick={() => { if (!sound) unlockAudio(); setSound((v) => !v); }} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] text-slate-400">Sound: {sound ? "On" : "Off"}</button><button type="button" onClick={() => resync.current()} disabled={busy || !connected} className="px-2 py-2 text-[10px] text-violet-300 disabled:opacity-40">Sync round ↻</button></div>
      </aside>
    </div>

    {lastWinner && <section className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-amber-300/20 bg-amber-400/[0.04] p-4 sm:p-5" aria-label="Last Jackpot winner"><PlayerAvatar user={lastWinner.winner.user} color={lastWinner.winner.color} large /><div className="min-w-0 flex-1"><p className="text-[9px] font-semibold uppercase tracking-widest text-amber-200/60">Last winner · Round #{lastWinner.roll.roundId}</p><p className="mt-1 truncate text-sm font-bold text-white">{lastWinner.winner.user.username}{lastWinner.winner.user.role === "BOT" && <span className="ml-2 text-[9px] text-amber-200">BOT</span>}</p><p className="mt-1 text-[10px] text-slate-500">Chance {lastWinner.chance.toFixed(2)}% · Winning ticket {lastWinner.roll.ticket}</p></div><p className="text-lg font-bold tabular-nums text-amber-100">${money(lastWinner.pot)}</p></section>}

    <section className="mt-6" aria-label="Jackpot players"><div className="mb-3 flex justify-between text-[10px] text-slate-500"><h2 className="font-semibold uppercase tracking-widest">Players · {players.length}</h2><span>{game.bets.length} entries</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{players.length ? players.map((p) => <div key={p.user.id} className={`flex min-w-0 items-center gap-3 rounded-xl border p-4 ${p.user.id === myId ? "border-violet-300/25 bg-violet-400/[0.07]" : "border-white/[0.07] bg-[#1e1f23]"}`}><PlayerAvatar user={p.user} color={p.color} /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{p.user.username}{p.user.id === myId ? " (you)" : ""}{p.user.role === "BOT" && <span className="ml-2 rounded bg-amber-400/10 px-1.5 py-0.5 text-[8px] text-amber-200">BOT</span>}</p><p className="mt-1 text-[10px] tabular-nums text-slate-500">${money(p.amount)}</p></div><span className="text-xs font-bold tabular-nums" style={{ color: p.color }}>{p.chance.toFixed(2)}%</span></div>) : <div className="rounded-xl border border-dashed border-white/10 px-5 py-8 text-center text-xs text-slate-500 sm:col-span-2 lg:col-span-3">{game.ready ? "No entries yet. The next entry will appear here live." : "Waiting for the server's player list…"}</div>}</div></section>
    <details className="mt-5 rounded-xl border border-white/[0.05] px-4 py-3 text-[10px] leading-relaxed text-slate-500"><summary className="cursor-pointer text-slate-400">Round details</summary><p className="mt-3">Chances reflect the existing server rules: bot stakes carry 1.3× weight. The server selects the winner and settles the pot.</p><dl className="mt-3 grid gap-2 break-all"><div><dt className="text-slate-600">Server seed / commitment</dt><dd>{game.round?.serverSeed || "—"}</dd></div><div><dt className="text-slate-600">EOS block</dt><dd>{game.round?.EOSBlock || "—"}</dd></div><div><dt className="text-slate-600">Client seed</dt><dd>{game.round?.clientSeed || "—"}</dd></div></dl></details>
  </main>;
}
