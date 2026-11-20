import { cleanedDropImage } from "@/lib/utils/drop-cutouts";
import { formatCurrency } from "@/lib/utils/numbers";
import type { PackItem } from "./packs";

/**
 * Shapes used by the OLD GalaxyBets backend for Battles.
 * (Taken from routes/games/battles/functions.js - mapBattle / startBattle.)
 */
export interface OldBattleItem {
  id: number | string;
  name?: string;
  img?: string | null;
  price?: number; // dollars
  probability?: number; // percent
}

export interface OldBattleCase {
  id: number | string;
  name?: string;
  slug?: string;
  img?: string | null;
  price?: number; // dollars
  items?: OldBattleItem[];
}

export interface OldBattlePlayer {
  id: number | string;
  username?: string;
  xp?: number;
  role?: string;
  slot: number; // 1-based seat
  team: number; // 1-based team
}

export interface OldRoundItem {
  userId: number | string;
  nonce?: number;
  result?: number;
  seed?: string;
  itemId: number | string;
}

export interface OldBattleRound {
  caseId: number | string;
  round: number; // 1-based
  items: OldRoundItem[];
}

export interface OldBattle {
  id: number | string;
  fastBattle?: boolean;
  cancelledAt?: string|null;
  creatorXp?: number|null;
  jackpotMeta?: any;
  ownerId?: number|string;
  sponsorOnly?: boolean;
  sponsorPaid?: number|string;
  fundingCode?:string|null;
  entryPrice?: number;
  teams: number;
  round?: number; // round currently being shown (0 = not started)
  privKey?: string | null;
  minLevel?: number;
  ownerFunding?: number;
  playersPerTeam: number;
  EOSBlock?: number | null;
  clientSeed?: string | null;
  serverSeed?: string | null;
  gamemode: string; // "standard" | "group"
  cases: OldBattleCase[];
  players: OldBattlePlayer[];
  rounds: OldBattleRound[];
  winnerTeam?: number | null;
  createdAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
}

/** Backend image paths go through the /api/v1 rewrite (same rule as packs.ts) */
export function resolveImage(src: unknown, fallback = "/assets/images/pack1.webp"): string {
  const value = typeof src === "string" ? src.trim() : "";
  if (!value) return fallback;
  if (/^(https?:|data:|blob:)/i.test(value)) return cleanedDropImage(value);
  if (value.startsWith("/api/v1/")) return cleanedDropImage(value);
  return cleanedDropImage(`/api/v1${value.startsWith("/") ? "" : "/"}${value}`);
}

/** Finds the item a roll landed on, using the case item lists of the battle */
export function findBattleItem(
  battle: OldBattle,
  caseId: number | string,
  itemId: number | string
): OldBattleItem | null {
  const c = (battle.cases || []).find((x) => String(x.id) === String(caseId));
  const item = c?.items?.find((i) => String(i.id) === String(itemId));
  return item ?? null;
}

/** Old item -> the PackItem shape the slot machines use */
export function oldItemToPackItem(item: OldBattleItem): PackItem {
  const price = Number(item.price) || 0;
  const prob = (Number(item.probability) || 0) / 100;
  const image = resolveImage(item.img, "");
  return {
    id: String(item.id),
    image,
    name: item.name ?? "",
    price: `$${formatCurrency(price)}`,
    probability: "",
    description: "",
    metadata: { probability: prob, normalizedWeight: prob },
    template: {
      imageUrl: image,
      name: item.name ?? "",
      value: String(price),
      description: "",
    },
  };
}

/**
 * Builds the "round resolved" data the battle room expects
 * from the results the old backend sends when the battle starts.
 * roundIndex is 0-based.
 */
export function buildRoundRolls(
  battle: OldBattle,
  roundIndex: number
): Array<{
  participantId: string;
  value: string;
  packReward: {
    id: string;
    name: string;
    value: string;
    imageUrl: string | null;
    description: string | null;
    metadata: { probability: number; normalizedWeight: number };
  };
}> | null {
  const rounds = battle.rounds || [];
  const round = rounds.find((r) => Number(r.round) === roundIndex + 1) ?? rounds[roundIndex];
  if (!round || !Array.isArray(round.items) || round.items.length === 0) return null;

  const rolls: NonNullable<ReturnType<typeof buildRoundRolls>> = [];
  for (const it of round.items) {
    const item = findBattleItem(battle, round.caseId, it.itemId);
    if (!item) continue;
    const prob = (Number(item.probability) || 0) / 100;
    rolls.push({
      participantId: String(it.userId),
      value: String(it.result ?? 0),
      packReward: {
        id: String(item.id),
        name: item.name ?? "",
        value: String(Number(item.price) || 0),
        imageUrl: resolveImage(item.img, "") || null,
        description: "",
        metadata: { probability: prob, normalizedWeight: prob },
      },
    });
  }
  return rolls.length > 0 ? rolls : null;
}
