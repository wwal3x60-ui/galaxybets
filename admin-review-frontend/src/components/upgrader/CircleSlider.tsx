"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { playWheelSpinning, stopWheelSpinning } from "@/lib/audio";

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 120;
const STROKE_WIDTH = 16;
const ARROW_OFFSET = 5; // px outside the circle
const OUTCOME_MIN = 5;
const OUTCOME_MAX = 80;

/** 0 = top (12 o'clock), clockwise in degrees */
function angleToXY(angleDeg: number) {
  const rad = ((90 - angleDeg) * Math.PI) / 180;
  return {
    x: CENTER + RADIUS * Math.cos(rad),
    y: CENTER - RADIUS * Math.sin(rad),
  };
}

function xyToAngle(x: number, y: number): number {
  const dx = x - CENTER;
  const dy = y - CENTER;
  const rad = Math.atan2(-dy, dx);
  let deg = 90 - (rad * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/** SVG arc path from startAngle to endAngle (degrees, 0=top, clockwise). endDeg may be >360. */
function arcPath(startDeg: number, endDeg: number): string {
  const endNorm = ((endDeg % 360) + 360) % 360;
  const start = angleToXY(startDeg);
  const end = angleToXY(endNorm);
  const sweep = 1; // clockwise
  const span = ((endNorm - startDeg + 360) % 360) || (startDeg === endNorm ? 360 : 0);
  const large = span > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} ${sweep} ${end.x} ${end.y}`;
}

export type CircleSliderProps = {
  value: number; // outcome % 5-80
  onChange: (value: number) => void;
  /** Start angle of the green arc (degrees, 0 = top, clockwise). Controlled from parent for win-range check. */
  startAngle: number;
  onStartAngleChange: (angle: number) => void;
  className?: string;
  /** When set, show arrow and animate it around the circle to this angle (for spin result) */
  spinAngle?: number | null;
  /** Spin duration in ms */
  spinDurationMs?: number;
  /** Full rotations before landing */
  spins?: number;
  /** Called when the arrow spin animation finishes */
  onSpinEnd?: () => void;
  /** Size in px (default 320) */
  size?: number;
};

export default function CircleSlider({
  value,
  onChange,
  startAngle,
  onStartAngleChange,
  className,
  spinAngle = null,
  spinDurationMs = 6500,
  spins = 8,
  onSpinEnd,
  size = SIZE,
}: CircleSliderProps) {
  const [arrowAngle, setArrowAngle] = useState(0);
  const outcome = Math.max(OUTCOME_MIN, Math.min(OUTCOME_MAX, value));
  const endAngle = (startAngle + (outcome / 100) * 360) % 360;

  // When spinAngle is set, run a single CSS transition from 0 to target (smooth, no per-frame re-renders)
  const arrowTargetAngle = spinAngle != null ? spins * 360 + spinAngle : 0;
  useEffect(() => {
    if (spinAngle == null) {
      setArrowAngle(0);
      return;
    }
    playWheelSpinning();
    setArrowAngle(0);
    const rafId = requestAnimationFrame(() => {
      requestAnimationFrame(() => setArrowAngle(arrowTargetAngle));
    });
    return () => cancelAnimationFrame(rafId);
  }, [spinAngle, arrowTargetAngle]);

  const arrowWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (spinAngle == null) return;
    const el = arrowWrapperRef.current;
    if (!el) return;
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === "transform") {
        stopWheelSpinning();
        onSpinEndRef.current?.();
      }
    };
    el.addEventListener("transitionend", onEnd);
    return () => el.removeEventListener("transitionend", onEnd);
  }, [spinAngle]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragKindRef = useRef<"start" | "end" | "arc" | null>(null);
  const dragStartAngleRef = useRef(0);
  const dragStartValueRef = useRef(0);
  const onSpinEndRef = useRef(onSpinEnd);
  onSpinEndRef.current = onSpinEnd;

  const getAngleFromEvent = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    return xyToAngle(x, y);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, kind: "start" | "end" | "arc") => {
      e.preventDefault();
      const angle = getAngleFromEvent(e);
      dragKindRef.current = kind;
      dragStartAngleRef.current = angle;
      // start handle: store fixed end angle so we can update range from the left
      // end handle: store current end angle for delta
      // arc: store start angle for moving the range
      dragStartValueRef.current =
        kind === "arc" ? startAngle : kind === "start" ? endAngle : endAngle;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [getAngleFromEvent, startAngle, endAngle]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const kind = dragKindRef.current;
      if (kind === null) return;
      const angle = getAngleFromEvent(e);
      let delta = angle - dragStartAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      dragStartAngleRef.current = angle;

      if (kind === "arc") {
        const newStart = (dragStartValueRef.current + delta + 360) % 360;
        dragStartValueRef.current = (dragStartValueRef.current + delta + 360) % 360;
        onStartAngleChange(newStart);
      } else if (kind === "start") {
        // Fix end angle: move start handle → range size changes (end stays fixed)
        const fixedEndAngle = dragStartValueRef.current;
        const pointerStart = (angle + 360) % 360;
        const rawRangeDeg = (fixedEndAngle - pointerStart + 360) % 360;
        let rangeDeg = rawRangeDeg;
        if (rangeDeg > (OUTCOME_MAX / 100) * 360) rangeDeg = (OUTCOME_MAX / 100) * 360;
        if (rangeDeg < (OUTCOME_MIN / 100) * 360) rangeDeg = (OUTCOME_MIN / 100) * 360;
        const newOutcome = Math.round((rangeDeg / 360) * 100);
        // When capped at 80% or 5%, place start so arc is exactly that size (end fixed)
        const newStart =
          rangeDeg === rawRangeDeg
            ? pointerStart
            : (fixedEndAngle - rangeDeg + 360) % 360;
        onStartAngleChange(newStart);
        onChange(Math.max(OUTCOME_MIN, Math.min(OUTCOME_MAX, newOutcome)));
      } else {
        // Fix start angle: move end handle → range size changes
        const newEnd = (dragStartValueRef.current + delta + 360) % 360;
        const currentStart = startAngle;
        let rangeDeg = (newEnd - currentStart + 360) % 360;
        if (rangeDeg > (OUTCOME_MAX / 100) * 360) rangeDeg = (OUTCOME_MAX / 100) * 360;
        dragStartValueRef.current = (currentStart + rangeDeg) % 360;
        const newOutcome = Math.round((rangeDeg / 360) * 100);
        onChange(Math.max(OUTCOME_MIN, Math.min(OUTCOME_MAX, newOutcome)));
      }
    },
    [getAngleFromEvent, startAngle, onChange, onStartAngleChange]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragKindRef.current = null;
  }, []);

  // While dragging start handle, pin the end position to the fixed angle so it doesn't jitter from rounding
  const effectiveEndAngle =
    dragKindRef.current === "start" ? dragStartValueRef.current : endAngle;

  const handleArcPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as SVGElement).closest("circle")) return;
      handlePointerDown(e, "arc");
    },
    [handlePointerDown]
  );

  const scale = size / SIZE;
  const startXY = angleToXY(startAngle);
  const endXY = angleToXY(effectiveEndAngle);

  return (
    <div
      ref={containerRef}
      className={cn("relative select-none touch-none", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={size}
        height={size}
        className="block"
      >
        {/* Background circle */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="white"
          strokeOpacity={0.08}
          strokeWidth={STROKE_WIDTH}
          className="cursor-grab active:cursor-grabbing"
        />
        {/* Green arc (selected range) */}
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d={arcPath(startAngle, effectiveEndAngle)}
          fill="none"
          stroke="#d83e4a"
          strokeWidth={STROKE_WIDTH}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={handleArcPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </svg>

      {/* Center content - outcome % */}
      <div
        className="absolute flex flex-col items-center justify-center inset-0 pointer-events-none"
        style={{ padding: size * 0.2 }}
      >
        <p className="text-xl select-none font-bold text-white tabular-nums">
          {outcome.toFixed(2)}%
        </p>
      </div>

      {/* Start handle */}
      <div
        className="absolute z-10 cursor-grab active:cursor-grabbing"
        style={{
          left: startXY.x * scale,
          top: startXY.y * scale,
          transform: "translate(-50%, -50%)",
        }}
        onPointerDown={(e) => handlePointerDown(e, "start")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <circle cx={12} cy={12} r={3} fill="white" />
        </svg>
      </div>

      {/* End handle */}
      <div
        className="absolute z-10 cursor-grab active:cursor-grabbing"
        style={{
          left: endXY.x * scale,
          top: endXY.y * scale,
          transform: "translate(-50%, -50%)",
        }}
        onPointerDown={(e) => handlePointerDown(e, "end")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <circle cx={12} cy={12} r={3} fill="white" />
        </svg>
      </div>

      {/* Arrow wrapper A: same size & center as slider; only rotate this div so arrow orbits */}
      {spinAngle != null ? (
        <div
          ref={arrowWrapperRef}
          className="absolute inset-0 pointer-events-none flex flex-col items-center justify-end"
          style={{
            transform: `rotate(${arrowAngle || 0}deg)`,
            transition: `transform ${spinDurationMs}ms cubic-bezier(0.12, 0.9, 0.12, 1)`,
          }}
        >
          <div className="relative w-full h-full">
            <div className="absolute top-0 left-1/2 -translate-x-1/2" style={{ marginBottom: -ARROW_OFFSET }}>
              <svg width={16} height={19} viewBox="0 0 18 20" fill="none">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.19568 7L4.18233 3.83192C3.66534 3.01843 4.30928 2 5.34062 2H12.6593C13.7088 2 14.3501 3.05089 13.7966 3.86376L11.6611 7H14.123C15.5923 7 16.4901 8.57634 15.7152 9.79564L10.4155 18.1349C9.66932 19.3091 7.91096 19.283 7.20166 18.0872L2.25526 9.74788C1.53148 8.52764 2.43299 7 3.87686 7H6.19568Z"
                  fill="white"
                />
              </svg>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
