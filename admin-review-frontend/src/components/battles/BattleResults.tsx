"use client";

import { Button, Image } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import type { Battle } from "@/lib/api/battles";
import { formatCurrency } from "@/lib/utils/numbers";

interface BattleResultsProps {
  battle: Battle;
  totals: number[];
  winnerSeats: number[];
  ready: boolean;
  pendingWinner: boolean;
  recreating: boolean;
  onReplay: () => void;
  onRecreate: () => void;
  onNewBattle: () => void;
}

export function calculateBattleSummary(totals: number[], winnerSeats: number[], ready: boolean) {
  if (!ready) return { pot: null, payoutPerWinner: null };
  const pot = totals.reduce((sum, value) => sum + value, 0);
  return { pot, payoutPerWinner: winnerSeats.length ? Math.round((pot / winnerSeats.length) * 100) / 100 : null };
}

export default function BattleResults({ battle, totals, winnerSeats, ready, pendingWinner, recreating, onReplay, onRecreate, onNewBattle }: BattleResultsProps) {
  const reduced = useReducedMotion();
  const summary = calculateBattleSummary(totals, winnerSeats, ready && !pendingWinner);
  const winner = winnerSeats.length === 1 ? battle.players[winnerSeats[0]] : undefined;
  const heading = pendingWinner ? "Choosing the winner…"
    : winnerSeats.length === 0 ? "Battle complete"
    : battle.mode === "SHARED" ? "Shared battle complete"
    : battle.battleType === "team" && battle.winnerTeamIndex != null ? `Team ${battle.winnerTeamIndex + 1} wins`
    : winner ? `${winner.name || "Player"} wins` : "Battle complete";
  const money = (value: number | null) => value == null ? "—" : `$${formatCurrency(value)}`;

  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="relative mx-auto my-8 w-full max-w-4xl overflow-hidden rounded-3xl border border-amber-300/15 bg-[#17181c] px-4 py-8 shadow-2xl sm:px-8"
      aria-label="Battle results"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 left-1/2 h-64 w-96 -translate-x-1/2 rounded-full bg-amber-400/[0.07] blur-3xl" />
      <div className="relative flex flex-col items-center text-center">
        <span className="rounded-full border border-amber-300/20 bg-amber-400/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200">Battle complete</span>
        <h2 className="mt-4 max-w-full break-words text-2xl font-bold tracking-tight text-white sm:text-3xl">{heading}</h2>
        <p className="mt-2 text-xs text-slate-500">Battle #{battle.id} · {battle.packCount} rounds · {battle.maxPlayers} players</p>
      </div>

      <div className="relative mx-auto mt-6 grid max-w-lg grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total drop pot</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">{money(summary.pot)}</p>
        </div>
        <div className="rounded-2xl border border-amber-300/15 bg-amber-400/[0.04] p-4 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/70">Per winning seat</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-200">{money(summary.payoutPerWinner)}</p>
        </div>
      </div>

      {!pendingWinner && (
        <div className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {battle.players.map((player, seat) => {
            const won = winnerSeats.includes(seat);
            const bot = player.kind === "BOT";
            const payout = !ready || winnerSeats.length === 0 ? null : won && !bot ? summary.payoutPerWinner : 0;
            return (
              <div key={`${player.id}-${seat}`} className={`relative min-w-0 rounded-2xl border p-4 ${won ? "border-amber-300/35 bg-gradient-to-br from-amber-400/[0.08] to-transparent" : "border-white/[0.06] bg-white/[0.02]"}`}>
                <div className="flex items-center gap-3">
                  <Image src={player.avatar || "/assets/avatar/dummy.png"} alt={player.name || "Player"} className={`h-11 w-11 rounded-full object-contain ${won ? "ring-2 ring-amber-300/50" : ""}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{player.name || `Seat ${seat + 1}`}</p>
                    <p className={`mt-1 text-[9px] font-bold uppercase tracking-widest ${won ? "text-amber-200" : "text-slate-500"}`}>{won ? "Winner" : "Finished"}{bot ? " · Bot" : ""}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-3 text-xs">
                  <div className="flex justify-between gap-2"><span className="text-slate-400">Own drops</span><span className="font-semibold tabular-nums text-slate-200">{money(ready ? totals[seat] ?? 0 : null)}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-slate-400">Balance payout</span><span className={`font-bold tabular-nums ${won && !bot ? "text-emerald-300" : "text-slate-400"}`}>{money(payout)}</span></div>
                </div>
                {bot && won && <p className="mt-2 text-[10px] text-slate-500">Bot winnings are not credited.</p>}
              </div>
            );
          })}
        </div>
      )}

      {!ready && !pendingWinner && <p className="mt-4 text-center text-xs text-slate-500">Loading recorded drops…</p>}
      {!pendingWinner && (
        <div className="relative mt-7 flex flex-col items-stretch justify-center gap-2 sm:flex-row">
          <Button onPress={onReplay} className="h-11 rounded-xl border border-blue-400/20 bg-blue-500/10 px-6 font-semibold text-blue-200">Replay battle</Button>
          <Button onPress={onRecreate} isDisabled={recreating} isLoading={recreating} className="h-11 rounded-xl mcPrimary px-6 font-semibold text-white">Recreate battle</Button>
          <Button onPress={onNewBattle} className="h-11 rounded-xl bg-white/[0.05] px-6 font-semibold text-slate-300">New battle</Button>
        </div>
      )}
    </motion.section>
  );
}
