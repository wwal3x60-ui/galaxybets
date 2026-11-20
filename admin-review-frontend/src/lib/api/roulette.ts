import { apiClient } from "./client";

export type RouletteColor = 0 | 1 | 2 | 3;
export interface RouletteBet { id: string; user: { id: string; username: string; anon: boolean }; color: RouletteColor; amount: number }
export interface RouletteRound { id: string; result: number | null; rolling: boolean; spinAt: number | null }
export interface RouletteState { round: RouletteRound | null; bets: RouletteBet[]; last: number[]; deadline: number; betTime: number; rollTime: number; maxBet: number; sideBetEnabled: boolean; sideBetMaxBet: number; ready: boolean }
export const emptyRoulette: RouletteState = { round: null, bets: [], last: [], deadline: 0, betTime: 15000, rollTime: 5000, maxBet: 10000, sideBetEnabled: false, sideBetMaxBet: 10000, ready: false };
export const rouletteColors = [
  { name: "Gold", multiplier: 14, numbers: "0" },
  { name: "Green", multiplier: 2, numbers: "1–7" },
  { name: "Red", multiplier: 2, numbers: "8–14" },
  { name: "Special", multiplier: 7, numbers: "1 & 8" },
] as const;
export function rouletteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value); return Number.isInteger(n) && n >= 0 && n <= 14 ? n : null;
}
export function rouletteColor(n: number): RouletteColor { return n === 0 ? 0 : n <= 7 ? 1 : 2; }
export function isRouletteSpecial(n: number): boolean { return n === 1 || n === 8; }
export function rouletteBetLimit(game: RouletteState, color: RouletteColor): number {
  return color === 0 ? 10000 : color === 3 ? game.sideBetMaxBet : game.maxBet;
}
function positive(value: unknown, fallback: number): number { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : fallback; }
export function readRouletteBets(values: unknown): RouletteBet[] {
  if (!Array.isArray(values)) return [];
  return values.flatMap((b) => {
    if (b?.id == null || b?.user?.id == null || ![0, 1, 2, 3].includes(Number(b.color)) || !Number.isFinite(Number(b.amount)) || Number(b.amount) < 0) return [];
    return [{ id: String(b.id), user: { id: String(b.user.id), username: b.user.anon ? "Anonymous" : String(b.user.username || "Player"), anon: Boolean(b.user.anon) }, color: Number(b.color) as RouletteColor, amount: Number(b.amount) }];
  });
}
export function mergeRouletteBets(current: RouletteBet[], incoming: RouletteBet[]): RouletteBet[] {
  const map = new Map(current.map((b) => [b.id, b])); incoming.forEach((b) => map.set(b.id, b)); return [...map.values()];
}
export function readRouletteSnapshot(data: any, now = Date.now()): RouletteState {
  if (data?.round?.id == null) throw new Error("Waiting for the Roulette round.");
  const rolling = Boolean(data.spinning || data.round.rolledAt || data.round.status === "rolling");
  const rollTime = positive(data.config?.rollTime, 5000);
  const serverTime = Date.parse(data.serverTime);
  const rolledAt = Date.parse(data.round.rolledAt);
  const elapsed = Number.isFinite(serverTime) && Number.isFinite(rolledAt) ? Math.max(0, serverTime - rolledAt) : 0;
  const seconds = Number(data.timeLeft);
  return {
    round: { id: String(data.round.id), rolling, result: rolling ? rouletteNumber(data.round.result) : null, spinAt: rolling ? now - elapsed : null },
    bets: readRouletteBets(data.bets), last: Array.isArray(data.last) ? data.last.map(rouletteNumber).filter((n: number | null): n is number => n !== null).slice(0, 100) : [],
    deadline: now + (rolling || !Number.isFinite(seconds) ? 0 : Math.max(0, seconds) * 1000),
    betTime: positive(data.config?.betTime, 15000), rollTime, maxBet: Math.min(10000, positive(data.config?.maxBet, 10000)),
    sideBetEnabled: data.config?.sideBet?.color === 3 && data.config?.sideBet?.multiplier === 7 && Array.isArray(data.config?.sideBet?.winningNumbers) && data.config.sideBet.winningNumbers.length === 2 && data.config.sideBet.winningNumbers.includes(1) && data.config.sideBet.winningNumbers.includes(8),
    sideBetMaxBet: Math.min(10000, positive(data.config?.sideBet?.maxBet, 10000)), ready: true,
  };
}
const messages: Record<string, string> = {
  DISABLED: "Roulette is currently unavailable.", ALREADY_STARTED: "Betting has closed for this round.", INVALID_COLOR: "Choose a valid color.", INVALID_AMOUNT: "Enter a bet of at least $0.20.", MAX_BET_ROULETTE: "Your total Roulette stake cannot exceed $10,000 per round.", INSUFFICIENT_BALANCE: "Your balance is too low for this bet.", ALREADY_BET_ON_OTHER_COLOR: "You can bet on green or red in a round, plus gold and special 7×. You cannot bet on both green and red.", SLOW_DOWN: "Please wait a moment before placing another bet.", INTERNAL_ERROR: "The server could not confirm this bet. Check your bets before trying again.",
};
export async function placeRouletteBet(amount: number, color: RouletteColor): Promise<void> {
  const response = await apiClient.post("/roulette/bet", { amount, color });
  if (response.data?.error) throw new Error(messages[response.data.error] || "The server rejected this bet.");
  if (response.data?.success !== true) throw new Error("Bet not confirmed. Check your bets before trying again.");
}
export function rouletteError(error: unknown): string {
  const e = error as { isAxiosError?: boolean; response?: { status?: number; data?: { error?: string } }; message?: string };
  const code = e.response?.data?.error;
  if (code && messages[code]) return messages[code];
  if (e.response?.status === 401) return "Log in to place a bet.";
  if (e.isAxiosError && !e.response) return "Connection interrupted. Your bet may have been accepted. Check your live bets before trying again.";
  return e.response ? "The bet could not be confirmed. Check your bets before trying again." : e.message || "Connection interrupted. Check your bets before trying again.";
}
