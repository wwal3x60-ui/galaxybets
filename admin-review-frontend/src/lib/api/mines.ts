import { apiClient } from "./client";

export interface MinesGame {
  amount: number;
  minesCount: number;
  revealedTiles: number[];
  multiplier: number;
  currentPayout: number;
}
export type MinesMove =
  | { outcome: "safe"; revealedTiles: number[]; multiplier: number; currentPayout: number }
  | { outcome: "lost"; revealedTiles: number[]; minePositions: number[] }
  | { outcome: "won"; payout: number; multiplier: number; minePositions: number[] };

function numeric(value: unknown): number {
  if (value == null || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0) throw new Error("The server returned an invalid Mines result. Check your round before continuing.");
  return Number(value);
}
function tiles(value: unknown): number[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed) || parsed.some((tile) => !Number.isInteger(tile) || tile < 0 || tile > 24) || new Set(parsed).size !== parsed.length) throw new Error("The server returned an invalid Mines board. Check your round before continuing.");
  return parsed;
}
export function decodeActiveMines(data: any): MinesGame | null {
  if (data?.activeGame === false) return null;
  const game = data?.activeGame;
  if (!game || !Number.isInteger(Number(game.minesCount)) || Number(game.minesCount) < 1 || Number(game.minesCount) > 24) throw new Error("Could not read the active Mines round.");
  return { amount: numeric(game.amount), minesCount: Number(game.minesCount), revealedTiles: tiles(game.revealedTiles), multiplier: numeric(game.multiplier), currentPayout: numeric(game.currentPayout) };
}
export function decodeMinesMove(data: any): MinesMove {
  if (data?.success !== true) throw new Error("The server did not confirm this action. Check your round.");
  if (data.isMine === true) return { outcome: "lost", revealedTiles: tiles(data.revealedTiles), minePositions: tiles(data.minePositions) };
  // Cash-out and automatic completion both return payout, without isMine.
  if (data.payout != null) return { outcome: "won", payout: numeric(data.payout), multiplier: numeric(data.multiplier), minePositions: tiles(data.minePositions) };
  if (data.isMine === false) return { outcome: "safe", revealedTiles: tiles(data.revealedTiles), multiplier: numeric(data.multiplier), currentPayout: numeric(data.currentPayout) };
  throw new Error("Could not read the round result. Check your round before continuing.");
}
export async function getActiveMines(): Promise<MinesGame | null> {
  const response = await apiClient.get("/mines");
  return decodeActiveMines(response.data);
}
export async function startMines(amount: number, minesCount: number): Promise<void> {
  const response = await apiClient.post("/mines/start", { amount, minesCount });
  if (response.data?.success !== true) throw new Error("The server did not confirm the start. Check your round.");
}
export async function revealMines(field: number): Promise<MinesMove> {
  const response = await apiClient.post("/mines/reveal", { field });
  return decodeMinesMove(response.data);
}
export async function cashoutMines(): Promise<MinesMove> {
  const response = await apiClient.post("/mines/cashout");
  const result = decodeMinesMove(response.data);
  if (result.outcome !== "won") throw new Error("Cash-out was not confirmed. Check your round.");
  return result;
}
const errors: Record<string, string> = {
  DISABLED: "Mines is currently unavailable.", SLOW_DOWN: "Please wait a moment before the next action.",
  INSUFFICIENT_BALANCE: "Your balance is too low for this bet.", INVALID_MINES_COUNT: "Choose between 1 and 24 mines.",
  MINES_MIN_BET: "The minimum bet is $0.20.", MINES_MAX_BET: "The maximum bet is $10,000.00.",
  MINES_GAME_ACTIVE: "You already have an active round. It will be restored below.",
  NO_MINES_GAME_ACTIVE: "This round has already ended. Check its status before starting another.",
  NO_REVEALED_TILES: "Reveal a safe tile before cashing out.", ALREADY_REVEALED: "That tile has already been revealed.",
  INVALID_FIELD: "That tile is not valid.", UNAUTHORIZED: "Log in to play Mines.",
};
export function minesError(error: unknown): string {
  const value = error as { response?: { status?: number; data?: { error?: string } }; message?: string };
  const code = value?.response?.data?.error;
  if (code && errors[code]) return errors[code];
  if (value?.response?.status === 401) return "Log in to play Mines.";
  if (!value?.response) return "Connection interrupted. Check the round before trying another action.";
  return "The action could not be confirmed. Check your round before continuing.";
}
