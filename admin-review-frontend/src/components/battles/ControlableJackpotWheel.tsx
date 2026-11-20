"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { formatDecimal, formatPercent } from "@/lib/utils/numbers";
import { playWheelSpinning, stopWheelSpinning } from "@/lib/audio";

export type JackpotWheelSegment = {
  id: string;
  label: string;
  color: string;
  startTicket: number; // inclusive, 1..1_000_000
  endTicket: number; // inclusive
};

const OUTCOME_MIN = 1;
const OUTCOME_MAX = 80;

type ControlableJackpotWheelProps = {
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
  /** When true and not spinning, user can drag the wheel left/right to set outcome % (circular slider) */
  controllable?: boolean;
  /** Current outcome percent 1–80; used to sync wheel rotation when not dragging */
  outcomePercent?: number;
  /** Called when user drags the wheel to change outcome (1–80) */
  onOutcomeChange?: (outcome: number) => void;
};

const MAX_TICKET = 1_000_000;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ticketToAngleDeg(ticket: number): number {
  // conic-gradient starts at 12 o'clock (0deg) and goes clockwise
  const t = clamp(ticket, 1, MAX_TICKET);
  return ((t - 1) / MAX_TICKET) * 360;
}

/** Angle from top (12 o'clock) clockwise in degrees, from pointer position relative to element center */
function getAngleFromCenter(evt: React.PointerEvent | PointerEvent, element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = (evt.clientX ?? 0) - cx;
  const dy = (evt.clientY ?? 0) - cy;
  const rad = Math.atan2(dx, -dy);
  return ((rad * 180) / Math.PI + 360) % 360;
}

export default function ControlableJackpotWheel({
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
  controllable = false,
  outcomePercent = 60,
  onOutcomeChange,
}: ControlableJackpotWheelProps) {
  const [rotationDeg, setRotationDeg] = useState(0);
  const [hasSpun, setHasSpun] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartAngleRef = useRef<number>(0);
  const dragStartRotationRef = useRef<number>(0);
  const didNotifyEndRef = useRef(false);
  const onSpinEndRef = useRef<(() => void) | undefined>(onSpinEnd);
  const wheelRef = useRef<HTMLDivElement | null>(null);

  // Keep latest callback without re-triggering the spin-end timer.
  useEffect(() => {
    onSpinEndRef.current = onSpinEnd;
  }, [onSpinEnd]);

  // Sync rotation from outcome % when controllable, not spinning, and not dragging
  const isControllableIdle = controllable && !autoSpin && !hasSpun;
  useEffect(() => {
    if (!isControllableIdle || isDragging) return;
    const pct = Math.max(OUTCOME_MIN, Math.min(OUTCOME_MAX, outcomePercent));
    setRotationDeg((pct / 100) * 360);
  }, [isControllableIdle, isDragging, outcomePercent]);

  const gradient = useMemo(() => {
    const stops = segments
      .map((s) => {
        const startDeg = (clamp(s.startTicket, 1, MAX_TICKET) - 1) / MAX_TICKET * 360;
        const endDeg = clamp(s.endTicket, 1, MAX_TICKET) / MAX_TICKET * 360;
        // Use higher precision to avoid boundary rounding showing wrong color at the pointer.
        return `${s.color} ${formatDecimal(startDeg, 6)}deg ${formatDecimal(endDeg, 6)}deg`;
      })
      .join(", ");
    return `conic-gradient(${stops})`;
  }, [segments]);

  const winnerSegment = useMemo(() => {
    if (!winnerId) return null;
    return segments.find((s) => s.id === winnerId) ?? null;
  }, [segments, winnerId]);

  const spin = () => {
    // To prevent visual mismatch on tight boundaries, land in the middle of the *winning range*
    // (still derived from the same provably-fair ticket).
    const seg =
      segments.find((s) => ticketNumber >= s.startTicket && ticketNumber <= s.endTicket) ??
      (winnerId ? segments.find((s) => s.id === winnerId) : null) ??
      null;

    const midTicket =
      seg != null ? seg.startTicket + Math.floor((seg.endTicket - seg.startTicket) / 2) : ticketNumber;

    const ticketAngle = ticketToAngleDeg(midTicket);
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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isControllableIdle || !wheelRef.current || !onOutcomeChange) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartAngleRef.current = getAngleFromCenter(e, wheelRef.current);
    dragStartRotationRef.current = rotationDeg;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isControllableIdle || !wheelRef.current || !onOutcomeChange || !isDragging) return;
    const angle = getAngleFromCenter(e, wheelRef.current);
    let delta = angle - dragStartAngleRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    dragStartAngleRef.current = angle;
    const nextRotation = dragStartRotationRef.current + delta;
    dragStartRotationRef.current = nextRotation;
    setRotationDeg(nextRotation);
    const normalized = ((nextRotation % 360) + 360) % 360;
    const outcome = Math.round(
      Math.max(OUTCOME_MIN, Math.min(OUTCOME_MAX, (normalized / 360) * 100))
    );
    onOutcomeChange(outcome);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  return (
    <div className={cn("relative flex flex-col items-center justify-center gap-4", className)}>
      <div className="relative flex items-center justify-center">
        {/* Pointer */}
        <div className="absolute top-0 rotate-180 z-20 flex items-center justify-center -translate-y-full">
          <div className="w-0 h-0 border-l-10 border-r-10 border-b-18 border-l-transparent border-r-transparent border-b-white" />
        </div>

        {/* Wheel */}
        <div
          ref={wheelRef}
          role={isControllableIdle ? "slider" : undefined}
          aria-label={isControllableIdle ? "Win chance percentage" : undefined}
          aria-valuemin={isControllableIdle ? OUTCOME_MIN : undefined}
          aria-valuemax={isControllableIdle ? OUTCOME_MAX : undefined}
          aria-valuenow={isControllableIdle ? outcomePercent : undefined}
          tabIndex={isControllableIdle ? 0 : undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className={cn(
            "relative w-[340px] h-[340px] rounded-full",
            "shadow-lg",
            isControllableIdle && "cursor-grab active:cursor-grabbing touch-none select-none"
          )}
          style={{
            backgroundImage: gradient,
            transform: `rotate(${rotationDeg}deg)`,
            transition: hasSpun ? `transform ${spinDurationMs}ms cubic-bezier(0.12, 0.9, 0.12, 1)` : undefined,
          }}
        >
          {/* Inner cutout to create ring */}
          <div className="absolute inset-[18px] rounded-full bg-[#0f1013]" />

          {/* Winner highlight ring */}
          {winnerSegment ? (
            <div className="absolute inset-0 rounded-full  pointer-events-none" />
          ) : null}
        </div>

        {/* Center label */}
        {showlabel && <div className="absolute z-10 flex flex-col items-center justify-center">
          <div className="text-white text-sm font-semibold">Jackpot</div>
          <div className="text-[#afafb4] text-xs">Ticket #{ticketNumber}</div>
        </div>}
      </div>

      {showLegend && segments.length > 0 ? (
        <div className="w-full max-w-[420px] grid grid-cols-1 gap-2">
          {segments
            .slice()
            .sort((a, b) => a.startTicket - b.startTicket)
            .map((s) => {
              const count = Math.max(0, s.endTicket - s.startTicket + 1);
              const pct = (count / MAX_TICKET) * 100;
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

