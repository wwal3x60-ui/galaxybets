import { apiClient } from "./client";

export interface JackpotUser { id: string; username: string; role: string; anon: boolean }
export interface JackpotBet { id: string; user: JackpotUser; amount: number; ticketsFrom: number; ticketsTo: number }
export interface JackpotConfig { betTime: number; rollTime: number; minBet: number; maxBet: number }
export interface JackpotRound { id: string; amount: number; closed: boolean; winnerBet: string | null; rolledAt: string | null; ticket: number | null; serverSeed: string | null; clientSeed: string | null; EOSBlock: string | null }
export interface JackpotSnapshot { round: JackpotRound; bets: JackpotBet[]; config: JackpotConfig; serverTime: string | null }
export interface JackpotPlayer { user: JackpotUser; amount: number; weight: number; chance: number; color: string }
export interface JackpotRoll { roundId: string; winnerBetId: string; ticket: number; serverSeed: string; clientSeed: string; winner: { user: JackpotUser; amount: number; totalAmount: number; chance: number } | null }
export const initialJackpotConfig: JackpotConfig = { betTime: 60000, rollTime: 5000, minBet: 0.2, maxBet: 10000 };
const palette = ["#8b7bff", "#38bdf8", "#fbbf24", "#fb7185", "#34d399", "#e879f9", "#fb923c", "#2dd4bf", "#a3e635", "#818cf8"];
function number(value: unknown, name: string): number {
  if (value == null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error(`Invalid Jackpot ${name}. Sync the round.`);
  return Number(value);
}
function identifier(value: unknown): string { if (value == null || String(value) === "") throw new Error("Missing Jackpot identifier. Sync the round."); return String(value); }
function user(value: any): JackpotUser { return { id: identifier(value?.id), username: value?.anon ? "Anonymous" : String(value?.username || "Player"), role: String(value?.role || "USER"), anon: Boolean(value?.anon) }; }
export function jackpotColor(id: string): string { let hash = 0; for (let i = 0; i < id.length; i++) hash = ((hash * 31) + id.charCodeAt(i)) >>> 0; return palette[hash % palette.length]; }
export function readJackpotBets(value: unknown): JackpotBet[] {
  if (!Array.isArray(value)) throw new Error("Could not read Jackpot bets. Sync the round.");
  const bets = new Map<string, JackpotBet>();
  for (const b of value) {
    const id = identifier(b?.id);
    bets.set(id, { id, user: user(b.user), amount: number(b.amount, "bet amount"), ticketsFrom: number(b.ticketsFrom, "ticket range"), ticketsTo: number(b.ticketsTo, "ticket range") });
  }
  return [...bets.values()];
}
export function jackpotPlayers(bets: JackpotBet[]): JackpotPlayer[] {
  const players = new Map<string, JackpotPlayer>();
  for (const bet of bets) {
    const previous = players.get(bet.user.id);
    // The server assigns inclusive ticket ranges. Roles never change their size.
    const weight = bet.ticketsTo - bet.ticketsFrom + 1;
    if (!Number.isSafeInteger(bet.ticketsFrom) || !Number.isSafeInteger(bet.ticketsTo) || bet.ticketsFrom < 0 || !Number.isSafeInteger(weight) || weight < 1) {
      throw new Error("Invalid Jackpot ticket range. Sync the round.");
    }
    if (previous) { previous.amount += bet.amount; previous.weight += weight; }
    else players.set(bet.user.id, { user: bet.user, amount: bet.amount, weight, chance: 0, color: jackpotColor(bet.user.id) });
  }
  const totalWeight = [...players.values()].reduce((sum, p) => sum + p.weight, 0);
  return [...players.values()].map((p) => ({ ...p, chance: totalWeight > 0 ? p.weight / totalWeight * 100 : 0 }));
}
export function readJackpotConfig(value: any): JackpotConfig {
  const result = { betTime: number(value?.betTime, "bet duration"), rollTime: number(value?.rollTime, "roll duration"), minBet: number(value?.minBet, "minimum bet"), maxBet: number(value?.maxBet, "maximum bet") };
  if (result.betTime <= 0 || result.rollTime <= 0 || result.minBet <= 0 || result.maxBet < result.minBet) throw new Error("Invalid Jackpot limits. Sync the round.");
  return result;
}
export function readJackpotSnapshot(value: any): JackpotSnapshot {
  const r = value?.round;
  return { round: { id: identifier(r?.id), amount: number(r.amount ?? 0, "pot"), closed: Boolean(value.spinning || r.EOSBlock || r.rolledAt || r.bettingClosed || r.endedAt), winnerBet: r.winnerBet == null ? null : String(r.winnerBet), rolledAt: r.rolledAt || null, ticket: r.winnerTicket == null && r.ticket == null ? null : number(r.winnerTicket ?? r.ticket, "winning ticket"), serverSeed: typeof r.serverSeed === "string" ? r.serverSeed : null, clientSeed: typeof r.clientSeed === "string" ? r.clientSeed : null, EOSBlock: r.EOSBlock == null ? null : String(r.EOSBlock) }, bets: readJackpotBets(value.bets), config: readJackpotConfig(value.config), serverTime: typeof value.serverTime === "string" ? value.serverTime : null };
}
export function readJackpotRoll(roundId: unknown, serverSeed: unknown, clientSeed: unknown, winnerBetId: unknown, ticket: unknown, info?: any): JackpotRoll {
  const chance = info == null ? null : number(info.chance, "winner chance");
  if (chance !== null && chance > 100) throw new Error("Invalid Jackpot chance. Sync the round.");
  return { roundId: identifier(roundId), winnerBetId: identifier(winnerBetId), ticket: number(ticket, "winning ticket"), serverSeed: typeof serverSeed === "string" ? serverSeed : "", clientSeed: typeof clientSeed === "string" ? clientSeed : "", winner: info == null ? null : { user: user(info.user), amount: number(info.amount, "winner stake"), totalAmount: number(info.totalAmount, "winner pot"), chance: chance! } };
}
const messages: Record<string, string> = {
  DISABLED: "Jackpot is currently unavailable.", ALREADY_STARTED: "Betting has closed. Wait for the next round.", INVALID_AMOUNT: "Enter a valid bet amount.", MIN_BET_JACKPOT: "This amount is below the round's minimum bet.", MAX_BET_JACKPOT: "Your total stake would exceed the round's limit.", SPONSOR_LOCK: "This account cannot join Jackpot.", INSUFFICIENT_BALANCE: "Your balance is too low for this bet.", SLOW_DOWN: "Please wait a moment before placing another bet.", INTERNAL_ERROR: "The server could not confirm this bet. Check your entries before trying again.",
};
export async function joinJackpot(amount: number): Promise<void> {
  const response = await apiClient.post("/jackpot/join", { amount });
  if (response.data?.error) throw new Error(messages[response.data.error] || "The server rejected this bet.");
  if (response.data?.success !== true) throw new Error("Bet not confirmed. Sync the round and check your entries before trying again.");
}
// Both the initial join and additional bets use the same existing backend route.
export const placeJackpotBet = joinJackpot;
export function jackpotError(error: unknown): string {
  const e = error as { isAxiosError?: boolean; response?: { status?: number; data?: { error?: string } }; message?: string };
  const code = e.response?.data?.error;
  if (code && messages[code]) return messages[code];
  if (e.response?.status === 401) return "Log in to join Jackpot.";
  if (e.isAxiosError) return "Bet not confirmed. It may already have been accepted. Sync the round and check your entries before trying again.";
  return e.message || "Could not read the Jackpot round. Try Sync round.";
}
