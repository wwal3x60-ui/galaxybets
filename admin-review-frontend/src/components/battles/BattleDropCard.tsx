"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { PackItem } from "@/lib/api/packs";
import { formatCurrency } from "@/lib/utils/numbers";

interface BattleDropCardProps {
  item?: PackItem | null;
  round: number;
  animateReveal?: boolean;
}

// Match the probability colors already used by the reels.
function dropColor(item: PackItem): string {
  const chance = Number(item.metadata?.probability);
  if (!Number.isFinite(chance) || chance <= 0) return "#9e9ea3";
  if (chance < 0.005) return "#f5c542";
  if (chance < 0.01) return "#ff626f";
  if (chance < 0.02) return "#eb808b";
  if (chance < 0.04) return "#eb808b";
  if (chance <= 0.05) return "#eb808b";
  return "#9e9ea3";
}

export default function BattleDropCard({ item, round, animateReveal = false }: BattleDropCardProps) {
  const reduceMotion = useReducedMotion();
  const [pulse, setPulse] = useState(animateReveal ? 1 : 0);
  const [imageFailed, setImageFailed] = useState(false);
  const artRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const color = item ? dropColor(item) : "#4d4e52";
  const name = item?.name || item?.template?.name || "Item";
  const image = item?.template?.imageUrl || item?.image;
  const rawValue = Number(item?.template?.value ?? String(item?.price ?? "").replace(/[^0-9.-]/g, ""));
  const price = formatCurrency(Number.isFinite(rawValue) ? rawValue : 0);
  const chance = Number(item?.metadata?.probability);
  const showChance = Number.isFinite(chance) && chance > 0;
  const animateHit = pulse > 0 && !reduceMotion;

  // Run after the DOM has committed, on both a new drop and every click.
  // Explicit animations avoid skipping entrance effects on keyed children.
  useEffect(() => {
    if (!item || pulse === 0 || reduceMotion) return;
    const animations: Animation[] = [];
    const play = (element: HTMLElement | null, frames: Keyframe[], duration: number) => {
      if (element && typeof element.animate === "function") {
        animations.push(element.animate(frames, { duration, easing: "ease-out" }));
      }
    };
    play(artRef.current, [
      { transform: "translateY(8px) scale(0.75) rotate(-8deg)" },
      { transform: "translateY(-8px) scale(1.3) rotate(4deg)", offset: 0.4 },
      { transform: "translateY(2px) scale(0.96) rotate(-2deg)", offset: 0.75 },
      { transform: "translateY(0) scale(1) rotate(0deg)" },
    ], 850);
    play(glowRef.current, [
      { opacity: 0.15, transform: "scale(0.7)" },
      { opacity: 0.8, transform: "scale(1.8)", offset: 0.35 },
      { opacity: 0.15, transform: "scale(1)" },
    ], 950);
    play(ringRef.current, [
      { opacity: 0.9, transform: "scale(0.4)" },
      { opacity: 0, transform: "scale(1.8)" },
    ], 800);
    return () => animations.forEach((animation) => animation.cancel());
  }, [pulse, reduceMotion, item]);

  if (!item) {
    return (
      <div className="flex min-h-[148px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.015]">
        <span className="text-2xl font-semibold tabular-nums text-white/10">{String(round).padStart(2, "0")}</span>
        <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500">Round {round}</span>
      </div>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={() => setPulse((previous) => previous + 1)}
      aria-label={`${name}, $${price}, round ${round}. Play drop animation.`}
      title={`${name} · $${price}${showChance ? ` · ${(chance * 100).toFixed(2)}% chance` : ""} · Click to animate`}
      initial={animateReveal && !reduceMotion ? { opacity: 0, y: 12 } : false}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      whileTap={reduceMotion ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.24 }}
      className="group relative isolate flex min-h-[148px] w-full min-w-0 cursor-pointer flex-col items-center overflow-hidden rounded-xl border px-2 pb-3 pt-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111216]"
      style={{ borderColor: `${color}38`, background: `linear-gradient(155deg, ${color}14, #16171b 65%)` }}
    >
      <span className="absolute left-2.5 top-2 text-[9px] font-semibold tabular-nums tracking-widest text-slate-500">{String(round).padStart(2, "0")}</span>
      <span className="absolute bottom-0 left-1/4 h-0.5 w-1/2 rounded-full" style={{ background: color }} />
      <div key={pulse} className="relative flex h-20 w-full items-center justify-center">
        <span
          ref={glowRef}
          aria-hidden="true"
          className="pointer-events-none absolute h-16 w-16 rounded-full blur-xl"
          style={{ background: color, opacity: 0.15 }}
        />
        <span ref={ringRef} aria-hidden="true" className="pointer-events-none absolute h-16 w-16 rounded-full border-2" style={{ borderColor: color, opacity: 0 }} />
        {animateHit && Array.from({ length: 8 }, (_, index) => {
          const angle = (index / 8) * Math.PI * 2;
          return (
            <motion.span key={index} aria-hidden="true" className="pointer-events-none absolute h-1 w-1 rounded-full"
              style={{ background: color }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
              animate={{ x: Math.cos(angle) * 48, y: Math.sin(angle) * 36, opacity: [0, 1, 0], scale: [0.5, 1.4, 0] }}
              transition={{ duration: 0.6, delay: index * 0.015 }}
            />
          );
        })}
        <div ref={artRef} className="relative z-10 flex h-[72px] w-[72px] items-center justify-center">
          {image && !imageFailed ? <img src={image} alt="" draggable={false} onError={() => setImageFailed(true)} className="h-full w-full object-contain drop-shadow-lg" /> : <span className="text-2xl font-bold text-white/40">?</span>}
        </div>
      </div>
      <span className="mt-1 w-full truncate text-center text-[10px] font-medium text-slate-400 group-hover:text-slate-200">{name}</span>
      <span className="mt-1 text-sm font-bold tabular-nums text-white">${price}</span>
    </motion.button>
  );
}
