"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image } from "@heroui/react";
import { cn } from "@/lib/utils/cn";
import { formatDecimal, formatPercent } from "@/lib/utils/numbers";
import { playWheelSpinning, stopWheelSpinning } from "@/lib/audio";

export type JackpotWheelSegment = {
  id: string;
  label: string;
  color: string;
  startTicket: number; // inclusive, 1..1_000_000
  endTicket: number; // inclusive
  /** When set, segment shows this joiner avatar on the wheel instead of the label. */
  avatar?: string | null;
};

type JackpotWheelProps = {
  segments: JackpotWheelSegment[];
  ticketNumber: number; // 1..1_000_000
  winnerId?: string | null;
  className?: string;
  spinDurationMs?: number;
  spins?: number; // full rotations before landing
  autoSpin?: boolean;
  onSpinEnd?: () => void;
  showLegend?: boolean;
  singleSpin?: boolean;
  showlabel?: boolean;
};

const MAX_TICKET = 1_000_000;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ticketToAngleDeg(ticket: number,total:number=MAX_TICKET): number {
  // conic-gradient starts at 12 o'clock (0deg) and goes clockwise
  const t = clamp(ticket,1,total);
  return ((t-1)/total)*360;
}

export default function JackpotWheel({
  segments,
  ticketNumber,
  winnerId,
  className,
  spinDurationMs = 7000,
  spins = 6,
  autoSpin = true,
  onSpinEnd,
  showLegend = true,
  singleSpin = false,
  showlabel = true,
}: JackpotWheelProps) {
  const totalTickets=Math.max(1,...segments.map(s=>s.endTicket));
  const [rotationDeg, setRotationDeg] = useState(0);
  const [hasSpun, setHasSpun] = useState(false);
  const didNotifyEndRef = useRef(false);
  const onSpinEndRef = useRef<(() => void) | undefined>(onSpinEnd);
  const wheelRef = useRef<HTMLDivElement | null>(null);

  // Keep latest callback without re-triggering the spin-end timer.
  useEffect(() => {
    onSpinEndRef.current = onSpinEnd;
  }, [onSpinEnd]);

  const gradient = useMemo(() => {
    const stops = segments
      .map((s) => {
        const startDeg = (clamp(s.startTicket, 1, totalTickets) - 1) / totalTickets * 360;
        const endDeg = clamp(s.endTicket, 1, totalTickets) / totalTickets * 360;
        // Use higher precision to avoid boundary rounding showing wrong color at the pointer.
        return `${s.color} ${formatDecimal(startDeg, 6)}deg ${formatDecimal(endDeg, 6)}deg`;
      })
      .join(", ");
    return `conic-gradient(${stops})`;
  }, [segments, totalTickets]);

  const winnerSegment = useMemo(() => {
    if (!winnerId) return null;
    return segments.find((s) => s.id === winnerId) ?? null;
  }, [segments, winnerId]);

  const segmentAngles = useMemo(() => {
    return segments.map((s) => {
      const startDeg = (clamp(s.startTicket, 1, totalTickets) - 1) / totalTickets * 360;
      const endDeg = clamp(s.endTicket, 1, totalTickets) / totalTickets * 360;
      const midDeg = (startDeg + endDeg) / 2;
      return { ...s, startDeg, endDeg, midDeg };
    });
  }, [segments, totalTickets]);

  const spin = () => {
    // To prevent visual mismatch on tight boundaries, land in the middle of the *winning range*
    // (still derived from the same provably-fair ticket).
    const seg =
      segments.find((s) => ticketNumber >= s.startTicket && ticketNumber <= s.endTicket) ??
      (winnerId ? segments.find((s) => s.id === winnerId) : null) ??
      null;

    const midTicket =
      seg != null ? seg.startTicket + Math.floor((seg.endTicket - seg.startTicket) / 2) : ticketNumber;

    const ticketAngle = ticketToAngleDeg(midTicket, totalTickets);
    // rotate wheel clockwise so the ticket angle lands at pointer (top)
    const final = (360 - ticketAngle) % 360;
    const target = spins * 360 + final;
    setRotationDeg(target);
    setHasSpun(true);
    playWheelSpinning();
  };

  useEffect(() => {
    if (!autoSpin) return;
    if (hasSpun) return;
    if (!Number.isFinite(ticketNumber) || ticketNumber <= 0) return;
    didNotifyEndRef.current = false;
    // delay a tick so initial render happens before transition
    const id = window.setTimeout(() => spin(), 150);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpin, hasSpun, ticketNumber]);

  useEffect(() => {
    if (!hasSpun) return;
    if (!onSpinEndRef.current) return;
    if (didNotifyEndRef.current) return;
    didNotifyEndRef.current = true;
    const id = window.setTimeout(() => {
      stopWheelSpinning();
      onSpinEndRef.current?.();
    }, spinDurationMs);
    return () => window.clearTimeout(id);
  }, [hasSpun, spinDurationMs]);

  const WHEEL_SIZE = 340;
  const INNER_CUTOUT = 18;
  const WHEEL_RADIUS = (WHEEL_SIZE - 24) / 2;
  const CUTOUT_RADIUS = WHEEL_RADIUS - INNER_CUTOUT;
  const LABEL_RADIUS = (CUTOUT_RADIUS + WHEEL_RADIUS) / 2;

  return (
    <div className={cn("relative flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative flex items-center justify-center">
        {/* Pointer - gradient arrow at top (12 o'clock), points down at wheel */}
        <div className="absolute top-0 z-20 flex items-center justify-center -translate-y-3/5 pointer-events-none rotate-180">
          <div
            className="w-10 h-12"
            style={{
              background: "linear-gradient(180deg, #FACC15 0%, #EC4899 40%, #eb808b 100%)",
              boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
              clipPath: "polygon(50% 0%, 100% 70%, 75% 70%, 75% 100%, 25% 100%, 25% 70%, 0% 70%)",
            }}
          />
        </div>

        {/* Thick black outer ring wrapper */}
        <div
          className="relative rounded-full p-4 bg-black"
          style={{
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          }}
        >
          {/* Wheel */}
          <div
            ref={wheelRef}
            className={cn(
              "relative rounded-full overflow-hidden",
              "ring-2 ring-black/30"
            )}
            style={{
              width: WHEEL_SIZE - 24,
              height: WHEEL_SIZE - 24,
              backgroundImage: gradient,
              transform: `rotate(${rotationDeg}deg)`,
              transition: hasSpun ? `transform ${spinDurationMs}ms cubic-bezier(0.12, 0.9, 0.12, 1)` : undefined,
              boxShadow:
                "inset 0 0 0 2px rgba(236,72,153,0.4), inset 0 0 0 3px rgba(139,92,246,0.25), inset 0 4 8 10px rgba(251,191,36,0.2)",
            }}
          >
            {/* Segment labels on the wheel (spin with wheel) - radial text */}
            {showlabel &&
              segmentAngles.map((seg) => (
                <div
                  key={seg.id}
                  className="absolute left-1/2 top-1/2 origin-center"
                  style={{
                    width: 1,
                    height: 1,
                    transform: `rotate(${seg.midDeg}deg) translateY(-${LABEL_RADIUS}px)`,
                  }}
                >
                  <div
                    className="absolute left-0 top-0 flex items-center justify-center"
                    style={{
                      transform: "rotate(0deg) translateX(-50%) translateY(50%)",
                    }}
                  >
                    {seg.avatar ? (
                      <span
                        className="flex shrink-0 overflow-hidden rounded-full ring-2 ring-white/40"
                        style={{
                          width: 36,
                          height: 36,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.4), 0 0 8px rgba(253,224,71,0.2)",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={seg.avatar}
                          alt={seg.label}
                          className="h-full w-full object-cover"
                          width={36}
                          height={36}
                        />
                      </span>
                    ) : (
                      <span
                        className="font-bold text-white whitespace-nowrap"
                        style={{
                          textShadow: "0 1px 2px rgba(0,0,0,0.5), 0 0 8px rgba(253,224,71,0.4)",
                          fontSize: "0.95rem",
                        }}
                      >
                        {seg.label}
                      </span>
                    )}
                  </div>
                </div>
              ))}

            {/* Inner cutout to create ring */}
            <div className="absolute inset-[80px] rounded-full bg-black/10 backdrop-blur-sm" />

            {/* Center hub - black circle with iridescent ring and glow */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black"
              style={{
                width: 72,
                height: 72,
                boxShadow:
                  "0 0 0 2px rgba(236,72,153,0.5), 0 0 0 4px rgba(139,92,246,0.3), 0 0 24px rgba(251,191,36,0.15)",
              }}
            />
          </div>
        </div>

        {/* Center label (over hub) */}
        {showlabel && (
          <div className="absolute z-10 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-white text-sm font-semibold">Jackpot</div>
            <div className="text-[#afafb4] text-xs">Ticket #{ticketNumber}</div>
          </div>
        )}
        <div className="absolute z-10 flex flex-col items-center justify-center pointer-events-none rounded-full">
          <img src={`/assets/images/jackpot.png`} alt="Jackpot" width={80} height={80} />
        </div>
      </div>

      {showLegend && segments.length > 0 ? (
        <div className="w-full max-w-[420px] grid grid-cols-1 gap-2">
          {segments
            .slice()
            .sort((a, b) => a.startTicket - b.startTicket)
            .map((s) => {
              const count = Math.max(0, s.endTicket - s.startTicket + 1);
              const pct = (count / totalTickets) * 100;
              const isWinner = winnerId != null && s.id === winnerId;
              return (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-md border",
                    "bg-[rgba(63,71,84,0.12)] border-[rgba(63,71,84,0.24)]",
                    isWinner && "border-white/50"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-sm text-white font-semibold truncate">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-[#afafb4] tabular-nums">
                      {s.startTicket.toLocaleString()}–{s.endTicket.toLocaleString()}
                    </span>
                    <span className="text-xs text-white/80 tabular-nums w-[56px] text-right">
                      {formatPercent(pct, 1, false)}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}

