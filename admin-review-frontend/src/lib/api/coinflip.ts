import { apiClient } from "./client";

export type CoinflipSide = "fire" | "ice";
export interface CoinflipUser { id: string; username: string; role: string; anon: boolean }
export interface Coinflip { id: string; ownerSide: CoinflipSide; fire: CoinflipUser | null; ice: CoinflipUser | null; amount: number; winnerSide: CoinflipSide | null; serverSeed: string; clientSeed: string | null; EOSBlock: string | null; createdAt: string | null; startedAt: string | null; resultAt: number | null }
export const COINFLIP_ANIMATION_MS = 11000;
function id(value: unknown): string { if (value == null || String(value) === "") throw new Error("Missing Coinflip identifier. Sync the lobby."); return String(value); }
export function coinflipSide(value: unknown): CoinflipSide { if (value !== "fire" && value !== "ice") throw new Error("Invalid Coinflip side. Sync the lobby."); return value; }
export function readCoinflipUser(value: any): CoinflipUser | null {
  if (value == null) return null;
  return { id: id(value.id), username: value.anon ? "Anonymous" : String(value.username || "Player"), role: String(value.role || "USER"), anon: Boolean(value.anon) };
}
export function readCoinflip(value: any, serverTime?: unknown, now = Date.now()): Coinflip {
  const amount = Number(value?.amount);
  if (value?.amount == null || !Number.isFinite(amount) || amount < 0.2 || amount > 10000) throw new Error("Invalid Coinflip stake. Sync the lobby.");
  const ownerSide = coinflipSide(value.ownerSide);
  const fire = readCoinflipUser(value.fire); const ice = readCoinflipUser(value.ice);
  if (!(ownerSide === "fire" ? fire : ice)) throw new Error("Missing Coinflip creator. Sync the lobby.");
  const winnerSide = value.winnerSide == null ? null : coinflipSide(value.winnerSide);
  if (winnerSide && (!fire || !ice)) throw new Error("Incomplete Coinflip result. Sync the lobby.");
  const startedMs = Date.parse(value.startedAt);
  const serverMs = Date.parse(typeof serverTime === "string" ? serverTime : "");
  // This anchor is solely for the visual reveal, not for gameplay or winner selection.
  const resultAt = winnerSide ? Number.isFinite(startedMs) ? Number.isFinite(serverMs) ? now - Math.max(0, serverMs - startedMs) : Math.min(now, startedMs) : now : null;
  return { id: id(value.id), ownerSide, fire, ice, amount, winnerSide, serverSeed: String(value.serverSeed || ""), clientSeed: typeof value.clientSeed === "string" ? value.clientSeed : null, EOSBlock: value.EOSBlock == null ? null : String(value.EOSBlock), createdAt: typeof value.createdAt === "string" ? value.createdAt : null, startedAt: typeof value.startedAt === "string" ? value.startedAt : null, resultAt };
}
export function readCoinflipList(value: unknown, serverTime?: unknown): Coinflip[] {
  if (!Array.isArray(value)) throw new Error("Could not read Coinflip games. Sync the lobby.");
  return [...new Map(value.map((raw) => { const flip = readCoinflip(raw, serverTime); return [flip.id, flip] as const; })).values()];
}
export function mergeCoinflip(previous: Coinflip | undefined, next: Coinflip): Coinflip {
  if (!previous) return next;
  // A delayed create response or duplicate snapshot must not undo a later socket event.
  return { ...next, fire: next.fire ?? previous.fire, ice: next.ice ?? previous.ice, EOSBlock: next.EOSBlock ?? previous.EOSBlock, winnerSide: next.winnerSide ?? previous.winnerSide, resultAt: previous.winnerSide && previous.resultAt !== null ? previous.resultAt : next.resultAt, startedAt: next.startedAt ?? previous.startedAt, clientSeed: next.clientSeed ?? previous.clientSeed, serverSeed: previous.winnerSide && !next.winnerSide ? previous.serverSeed : next.serverSeed };
}
export function coinflipJoinable(flip: Coinflip): boolean { return !flip.winnerSide && !flip.EOSBlock && (!flip.fire || !flip.ice); }
export function coinflipOwner(flip: Coinflip): CoinflipUser { return flip[flip.ownerSide]!; }
export function applyCoinflipJoin(flip: Coinflip, side: unknown, rawUser: unknown): Coinflip {
  const target = coinflipSide(side); const player = readCoinflipUser(rawUser);
  if (!player) throw new Error("Missing joined player. Sync the lobby.");
  return { ...flip, [target]: player };
}
export function applyCoinflipStarted(flip: Coinflip, clientSeed: unknown, serverSeed: unknown, side: unknown, now = Date.now()): Coinflip {
  const winnerSide = coinflipSide(side);
  if (!flip.fire || !flip.ice) throw new Error("Waiting for both players. Sync the lobby.");
  return { ...flip, winnerSide, resultAt: flip.resultAt ?? now, startedAt: flip.startedAt ?? new Date(now).toISOString(), clientSeed: typeof clientSeed === "string" ? clientSeed : null, serverSeed: typeof serverSeed === "string" ? serverSeed : flip.serverSeed };
}
const messages: Record<string, string> = {
  DISABLED: "Coinflip is currently unavailable.", INVALID_AMOUNT: "Enter a stake from $0.20 to $10,000.00.", INVALID_SIDE: "Choose fire or ice.", INVALID_ID: "This game is no longer available. Sync the lobby.", ALREADY_STARTED: "Another player already joined this game.", ALREADY_JOINED: "You already own an entry in this game.", INSUFFICIENT_BALANCE: "Your balance is too low for this stake.", FORBIDDEN: "Only the creator can call a bot for this game.", NO_BOTS_AVAILABLE: "The backend has no bot account available.", SLOW_DOWN: "Wait a moment before your next action.", INTERNAL_ERROR: "The server could not confirm this action. Sync the lobby and check your games before trying again.",
};
function confirm(data: any): void { if (data?.error) throw new Error(messages[data.error] || "The server rejected this action."); if (data?.success !== true) throw new Error("Action not confirmed. Sync the lobby before trying again."); }
export async function createCoinflip(amount: number, side: CoinflipSide): Promise<Coinflip> { const response = await apiClient.post("/coinflip/create", { amount, side }); confirm(response.data); return readCoinflip(response.data.coinflip); }
export async function joinCoinflip(gameId: string): Promise<void> { const response = await apiClient.post(`/coinflip/${encodeURIComponent(gameId)}/join`); confirm(response.data); }
export async function callCoinflipBot(gameId: string): Promise<void> { const response = await apiClient.post(`/coinflip/${encodeURIComponent(gameId)}/bot`); confirm(response.data); }
export function coinflipError(error: unknown): string {
  const e = error as { isAxiosError?: boolean; response?: { status?: number; data?: { error?: string } }; message?: string };
  const code = e.response?.data?.error;
  if (code && messages[code]) return messages[code];
  if (e.response?.status === 401) return "Log in to play Coinflip.";
  if (e.isAxiosError) return "Action not confirmed. It may already have succeeded. Sync the lobby and check your games before trying again.";
  return e.message || "Could not read Coinflip. Sync the lobby.";
}
