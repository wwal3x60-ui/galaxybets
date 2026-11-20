/**
 * Client-only celebration effect (fireworks-like) for battle end.
 * Uses canvas-confetti for a short burst. Safe to call from event handlers.
 */
export function fireBattleCelebration(): void {
  if (typeof window === "undefined") return;
  import("canvas-confetti").then(({ default: confetti }) => {
    const colors = ["#ffd700", "#ff6b6b", "#4ecdc4", "#a855f7", "#f97316"];
    const burst = () => {
      confetti({
        particleCount: 8,
        angle: 60,
        spread: 55,
        origin: { x: 0.2, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 8,
        angle: 120,
        spread: 55,
        origin: { x: 0.8, y: 0.7 },
        colors,
      });
    };
    burst();
    setTimeout(burst, 200);
    setTimeout(burst, 450);
    setTimeout(burst, 700);
  }).catch(() => {});
}
