import { io, type Socket } from "socket.io-client";
import { formatCurrency } from "@/lib/utils/numbers";
import type { PackItem } from "./packs";
import {
  type OldBattle,
  findBattleItem,
  oldItemToPackItem,
  resolveImage,
} from "./battle-protocol";

/**
 * Battles for the OLD GalaxyBets backend.
 *
 * The old backend has NO "list battles" / "get battle" HTTP routes.
 * Battles are read over the socket:
 *   emit "battles:subscribe"            -> server sends "battles:push" (the lobby list)
 *   emit "battles:subscribe", id, pk    -> server sends "battle" (one full battle)
 * and changed with HTTP routes:
 *   POST /battles/create, POST /battles/:id/join, POST /battles/:id/bot
 */

const SOCKET_URL = typeof window === "undefined"
  ? (process.env.API_INTERNAL_SOCKET_URL || process.env.API_INTERNAL_BASE_URL || "http://127.0.0.1:3001")
  : (process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin);

export interface BattlePlayer {
  id: string;
  avatar: string;
  name?: string;
  betAmount?: string;
  participantId?: string;
  seatIndex?: number;
  teamIndex?: number | null;
  kind?: "HUMAN" | "BOT";
  eliminatedAtRound?: number | null;
}

export interface BattlePack {
  id: string;
  name: string;
  image: string;
  items?: PackItem[];
}

export type BattleMode = "CLASSIC" | "SHARED" | "POINT_RUSH" | "JACKPOT" | "ELIMINATION";
export type BattleType = "solo" | "team";

export type JackpotTicketRange = { participantId: string; start: number; end: number };
export type JackpotMeta = {
  pot?: string;
  upsideDown?: boolean;
  ticket: number;
  ranges: JackpotTicketRange[];
  nonce?: number;
  clientSeeds?: string[];
  combinedClientSeed?: string;
};

export interface SoloBattleConfig {
  type: "solo";
  playerCount: 2 | 3 | 4 | 6;
}

export interface TeamBattleConfig {
  type: "team";
  teamCount: 2 | 3;
  playersPerTeam: 2 | 3;
}

export type BattleConfig = SoloBattleConfig | TeamBattleConfig;

export interface Battle {
  id: string;
  mode: BattleMode;
  battleType: BattleType;
  packs: BattlePack[];
  packCount: number;
  cost: string;
  entryCost?: string;
  players: BattlePlayer[];
  createdByUserId?: string;
  winnerParticipantId?: string | null;
  winnerTeamIndex?: number | null;
  jackpotWinnerParticipantId?: string | null;
  ownerFunding?: number;
  sponsorOnly?: boolean;
  sponsorPaid?: string;
  fundingCode?: string|null;
  cancelledAt?: string|null;
  canCancel?: boolean;
  fastBattle?: boolean;
  lastChance?: boolean;
  upsideDown?: boolean;
  countdownEndsAt?: string | null;
  roundsMeta?: Array<{ roundIndex: number; resolvedAt?: string | null }>;
  playerCount: number;
  teamCount?: number;
  playersPerTeam?: number;
  maxPlayers: number;
  status: "waiting" | "in_progress" | "completed";
  unboxedValue?: string;
  createdAt: string;

  resultsBySeat?: Record<number, Array<PackItem | null>>;
  jackpotMeta?: JackpotMeta | null;
}

export interface GetBattlesFilters {
  mode?: BattleMode | "All";
  sort?: "Price: Low to high" | "Price: High to low" | "Newest" | "Oldest";
  status?: "All" | "waiting" | "in_progress" | "completed";
  page?: number;
  limit?: number;
  offset?: number;
}

export interface BattlesPage {
  battles: Battle[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

/** A battle exactly as the old backend sends it */
export type BackendBattle = OldBattle;

// ---------------------------------------------------------------------------
// Mapping: old backend battle -> Battle used by the pages
// ---------------------------------------------------------------------------

export function mapBackendBattleToBattle(b: BackendBattle): Battle {
  const teams = Math.max(1, Number(b.teams) || 1);
  const perTeam = Math.max(1, Number(b.playersPerTeam) || 1);
  const maxPlayers = teams * perTeam;

  // "group" = everyone shares the pot (Share mode). "standard" = Classic.
  const isShare = b.gamemode === "group";
  const mode: BattleMode=isShare?"SHARED":b.gamemode==="jackpot"?"JACKPOT":"CLASSIC";
  const battleType: BattleType = !isShare && perTeam > 1 ? "team" : "solo";

  const rounds = [...(b.rounds || [])].sort((a, c) => Number(a.round) - Number(c.round));
  const casesById = new Map((b.cases || []).map((c) => [String(c.id), c]));

  const packs: BattlePack[] = rounds.map((r) => {
    const c = casesById.get(String(r.caseId));
    return {
      id: String(r.caseId),
      name: c?.name ?? "Pack",
      image: resolveImage(c?.img, "/assets/images/pack1.webp"),
      // Full battle snapshots contain the case version used by this battle.
      // Keep those items so reels do not depend on a second catalog request.
      items: Array.isArray(c?.items) ? c.items.map(oldItemToPackItem) : undefined,
    };
  });

  const perPlayerCost = rounds.reduce(
    (sum, r) => sum + (Number(casesById.get(String(r.caseId))?.price) || 0),
    0
  );
  const costText = `$${formatCurrency(perPlayerCost)}`;
  const entryText = `$${formatCurrency((b.sponsorOnly||Number(b.ownerFunding)>0)?Number(b.entryPrice)||0:perPlayerCost)}`;

  const bySlot = new Map((b.players || []).map((p) => [Number(p.slot), p]));
  const players: BattlePlayer[] = Array.from({ length: maxPlayers }).map((_, seat) => {
    const p = bySlot.get(seat + 1);
    const uid = p ? String(p.id) : undefined;
    return {
      id: uid ?? `empty-${seat}`,
      avatar: p ? `/api/v1/user/${p.id}/img` : "/assets/avatar/dummy.png",
      name: p?.username,
      betAmount: p && !b.sponsorOnly && Number(b.ownerFunding)>0 && String(p.id)===String(b.ownerId) ? `$${formatCurrency(perPlayerCost)}` : entryText,
      participantId: uid,
      seatIndex: seat,
      teamIndex: p ? Math.max(0, Number(p.team) - 1) : Math.floor(seat / perTeam),
      kind: p ? (String(p.role ?? "").toUpperCase() === "BOT" ? "BOT" : "HUMAN") : undefined,
      eliminatedAtRound: null,
    };
  });

  const ended = Boolean(b.endedAt) || (b.winnerTeam != null && b.winnerTeam !== undefined);
  const currentRound = Number(b.round) || 0;
  const status: Battle["status"] = ended ? "completed" : b.startedAt ? "in_progress" : "waiting";

  // A round counts as "resolved" once its spin is over. The old backend sends all
  // results at the start, so we only reveal rounds that already finished.
  const isResolved = (roundNumber: number) => ended || roundNumber < currentRound;
  const stamp = b.endedAt ?? b.startedAt ?? new Date().toISOString();
  const roundsMeta = rounds.map((r, idx) => ({
    roundIndex: idx,
    resolvedAt: isResolved(Number(r.round)) ? stamp : null,
  }));

  let resultsBySeat: Record<number, Array<PackItem | null>> | undefined;
  if (b.startedAt) {
    const rb: Record<number, Array<PackItem | null>> = {};
    for (let s = 0; s < maxPlayers; s += 1) rb[s] = rounds.map(() => null);
    let any = false;
    rounds.forEach((r, idx) => {
      if (!isResolved(Number(r.round))) return;
      for (const it of r.items || []) {
        const player = (b.players || []).find((p) => String(p.id) === String(it.userId));
        const item = findBattleItem(b, r.caseId, it.itemId);
        if (!player || !item) continue;
        const seat = Number(player.slot) - 1;
        if (rb[seat]) {
          rb[seat][idx] = oldItemToPackItem(item);
          any = true;
        }
      }
    });
    if (any) resultsBySeat = rb;
  }

  const winnerTeam = b.winnerTeam ?? null;
  let winnerParticipantId: string | null = null;
  if (ended && winnerTeam != null && !isShare) {
    const w = (b.players || []).find((p) => Number(p.team) === Number(winnerTeam));
    if (w) winnerParticipantId = String(w.id);
  }

  // The creator always sits in seat 1 (the old backend puts them there).
  const owner = bySlot.get(1);

  let createdAt = new Date().toISOString();
  if (b.createdAt) {
    const d = new Date(b.createdAt as string);
    if (!Number.isNaN(d.getTime())) createdAt = d.toISOString();
  }

  return {
    id: String(b.id),
    mode,
    battleType,
    packs,
    packCount: packs.length,
    cost: costText,
    entryCost: entryText,
    players,
    createdByUserId:b.ownerId!=null?String(b.ownerId):owner?String(owner.id):undefined,
    ownerFunding:Number(b.ownerFunding)||0,
    sponsorOnly:!!b.sponsorOnly,sponsorPaid:String(b.sponsorPaid??0),fundingCode:b.fundingCode??null,
    cancelledAt:b.cancelledAt??null,
    canCancel:b.creatorXp!=null&&!b.cancelledAt&&!b.startedAt&&!b.endedAt&&!b.EOSBlock&&(b.players||[]).length===(b.sponsorOnly?0:1),
    fastBattle:!!b.fastBattle,
    lastChance: false,
    upsideDown: false,
    countdownEndsAt: null,
    roundsMeta,
    winnerParticipantId,
    winnerTeamIndex: winnerTeam != null ? Number(winnerTeam) - 1 : null,
    jackpotWinnerParticipantId:b.jackpotMeta?String(b.jackpotMeta.winnerParticipantId??(b.players||[]).find(p=>Number(p.team)===Number(b.winnerTeam))?.id??""):null,
    playerCount: maxPlayers,
    teamCount: battleType === "team" ? teams : undefined,
    playersPerTeam: battleType === "team" ? perTeam : undefined,
    maxPlayers,
    status,
    createdAt,
    resultsBySeat,
    jackpotMeta:b.jackpotMeta?{...b.jackpotMeta,ticket:Number(b.jackpotMeta.ticket)+1,ranges:b.jackpotMeta.ranges.map((r:any)=>({...r,start:Number(r.start)+1,end:Number(r.end)+1}))}:null,
  };
}

// ---------------------------------------------------------------------------
// Helpers (unchanged logic)
// ---------------------------------------------------------------------------

export function getBattleFormat(battle: Battle): string {
  if (battle.battleType === "solo") {
    if (battle.playerCount === 2) return "1vs1";
    if (battle.playerCount === 3) return "1vs1vs1";
    if (battle.playerCount === 4) return "1vs1vs1vs1";
    if (battle.playerCount === 6) return "1vs1vs1vs1vs1vs1";
    return `${battle.playerCount} players`;
  }
  if (battle.teamCount === 2 && battle.playersPerTeam) {
    return `${battle.playersPerTeam}vs${battle.playersPerTeam}`;
  }
  if (battle.teamCount === 3 && battle.playersPerTeam) {
    return `${battle.playersPerTeam}vs${battle.playersPerTeam}vs${battle.playersPerTeam}`;
  }
  return `${battle.playerCount} players`;
}

export function isTeamBattle(battle: Battle): boolean {
  return battle.battleType === "team";
}

export function isSoloBattle(battle: Battle): boolean {
  return battle.battleType === "solo";
}

// ---------------------------------------------------------------------------
// Reading battles over the socket
// ---------------------------------------------------------------------------

function getPrivKeyFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return new URLSearchParams(window.location.search).get("pk");
  } catch {
    return null;
  }
}

/** Waits until the shared websocket is connected (connects it if nobody did yet) */
async function ensureConnected(timeoutMs: number): Promise<Socket | null> {
  if (typeof window === "undefined") return null;

  // This module is also imported by server-rendered battle pages. Load the
  // browser socket and auth store only when running in the browser.
  const [{ websocketManager }, { useAuthStore }] = await Promise.all([
    import("../websocket"),
    import("@/store/auth.store"),
  ]);

  return new Promise((resolve) => {
    if (!websocketManager.getSocket()) {
      try {
        websocketManager.connect(useAuthStore.getState().token ?? undefined);
      } catch {
        // ignore
      }
    }
    if (websocketManager.isConnected()) return resolve(websocketManager.getSocket());

    let done = false;
    let unsub: (() => void) | null = null;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      unsub?.();
      resolve(null);
    }, timeoutMs);

    unsub = websocketManager.subscribeStatus((s) => {
      if (done || !s.connected) return;
      done = true;
      window.clearTimeout(timer);
      unsub?.();
      resolve(websocketManager.getSocket());
    });
    if (done) unsub?.();
  });
}

type RequestOptions<T> = {
  /** arguments of the "battles:subscribe" message */
  subscribeArgs: unknown[];
  /** the server event that answers it */
  event: string;
  /** return the result for the matching answer, or undefined to keep waiting */
  match: (...args: any[]) => T | undefined;
  /** resolve with null when the server says "Battle not found" */
  watchNotFound?: boolean;
  timeoutMs?: number;
};

/** Browser: use the shared socket. Server (page rendering): use a short-lived socket. */
async function socketRequest<T>(opts: RequestOptions<T>): Promise<T | null> {
  const timeoutMs = opts.timeoutMs ?? 7000;
  const isServer = typeof window === "undefined";

  let socket: Socket | null;
  let temporary = false;

  if (isServer) {
    temporary = true;
    socket = io(SOCKET_URL, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: 5000,
    });
  } else {
    socket = await ensureConnected(8000);
    if (!socket) return null;
  }

  const sock = socket;

  return new Promise<T | null>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      sock.off(opts.event, onEvent);
      sock.off("toast", onToast);
      sock.off("connect_error", onError);
      if (temporary) sock.disconnect();
      resolve(value);
    };
    const onEvent = (...args: any[]) => {
      const value = opts.match(...args);
      if (value !== undefined) finish(value);
    };
    const onToast = (type: string, message: string) => {
      if (opts.watchNotFound && type === "error" && /not found/i.test(String(message))) finish(null);
    };
    const onError = () => finish(null);

    timer = setTimeout(() => finish(null), timeoutMs);
    sock.on(opts.event, onEvent);
    sock.on("toast", onToast);
    if (temporary) sock.on("connect_error", onError);

    const send = () => sock.emit("battles:subscribe", ...opts.subscribeArgs);
    if (temporary && !sock.connected) sock.once("connect", send);
    else send();
  });
}

async function fetchLobbyList(): Promise<BackendBattle[]> {
  const list = await socketRequest<BackendBattle[]>({
    subscribeArgs: [],
    event: "battles:push",
    match: (data) => (Array.isArray(data) ? (data as BackendBattle[]) : undefined),
  });
  return list ?? [];
}

function emptyPage(filters?: GetBattlesFilters): BattlesPage {
  return {
    battles: [],
    total: 0,
    hasMore: false,
    limit: filters?.limit ?? 50,
    offset: filters?.offset ?? 0,
  };
}

/** Get battles (array only; use getBattlesPage for pagination) */
export async function getBattles(filters?: GetBattlesFilters): Promise<Battle[]> {
  const page = await getBattlesPage({
    ...filters,
    limit: filters?.limit ?? 50,
    offset: filters?.offset ?? 0,
  });
  return page.battles;
}

export async function getBattlesPage(filters?: GetBattlesFilters): Promise<BattlesPage> {
  const limit = filters?.limit ?? 50;
  const offset = filters?.offset ?? 0;
  try {
    const raw=(await fetchLobbyList()).filter(b=>!b.cancelledAt);
    let battles = raw
      .map((b) => {
        try {
          return mapBackendBattleToBattle(b);
        } catch (e) {
          console.warn("Skipping a battle that could not be read:", e);
          return null;
        }
      })
      .filter((b): b is Battle => b !== null)
      .sort((a, c) => Number(c.id) - Number(a.id)); // newest first

    if (filters?.status && filters.status !== "All") {
      battles = battles.filter((b) => b.status === filters.status);
    }

    const total = battles.length;
    const slice = battles.slice(offset, offset + limit);
    return { battles: slice, total, hasMore: offset + slice.length < total, limit, offset };
  } catch (error) {
    console.warn("Could not load battles:", error);
    return emptyPage(filters);
  }
}

/** Get one battle with all its details */
export async function getBattleById(id: string, privKey?: string | null): Promise<Battle | null> {
  try {
    const pk = privKey ?? getPrivKeyFromUrl();
    const snap = await socketRequest<BackendBattle>({
      subscribeArgs: [Number.isFinite(Number(id)) ? Number(id) : id, pk ?? null],
      event: "battle",
      match: (data) => (data && String(data.id) === String(id) ? (data as BackendBattle) : undefined),
      watchNotFound: true,
    });
    return snap ? mapBackendBattleToBattle(snap) : null;
  } catch (error) {
    console.warn("Could not load battle:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Changing battles (HTTP)
// ---------------------------------------------------------------------------

const ERROR_MESSAGES: Record<string, string> = {
  DISABLED: "Battles are currently disabled.",
  SLOW_DOWN: "Please slow down and try again.",
  UNAUTHORIZED: "Please log in first.",
  INSUFFICIENT_BALANCE: "You don't have enough balance.",
  INSUFFICIENT_LEVEL: "Your level is too low for this battle.",
  TOO_MANY_BATTLES: "You already have 1,000 active battles. Finish or cancel one before creating another.",
  INVALID_AMOUNT: "The battle cost is too low.",
  SPONSOR_LOCK_FUNDING: "Your account cannot fund battles.",
  GAMEMODE_DISABLED: "This game mode is disabled.",
  INVALID_CASES: "One of the selected packs is not valid.",
  INVALID_GAMEMODE: "This game mode or player setup is not valid.",
  INVALID_TEAMS: "This player setup is not available.",
  INVALID_PLAYERS_PER_TEAM: "This player setup is not available.",
  ALREADY_STARTED: "This battle already started.",
  SLOT_TAKEN: "That seat was just taken. Pick another one.",
  ALREADY_IN_BATTLE: "You are already in this battle.",
  INVALID_PRIV_KEY: "This battle is private.",
  INVALID_BATTLE_ID: "This battle does not exist.",
  FORBIDDEN: "Only the creator can add bots.",
  NO_BOTS_AVAILABLE: "No bots are available right now.",
  INVALID_SLOT: "That seat does not exist.",
};

function getErrorMessage(error: any, fallback: string): string {
  const code = error?.response?.data?.error;
  if(code==='AFFILIATE_REQUIRED')return 'Only players linked to the required referral code can join.';
  if(code==='MAX_BET_BATTLE')return 'The maximum battle contribution or player entry is $10,000.';
  if(code==='SPONSOR_CANNOT_JOIN')return 'You are the sponsor and cannot compete in this battle.';
  if(code==='FUNDED_BATTLE_HUMANS_ONLY')return 'Sponsored battles are for real players only.';
  if(code==='INVALID_AFFILIATE_CODE')return 'Enter a valid referral code.';
  if(code==='NO_FUNDED_BOTS')return 'No funded bot is available for this jackpot battle.';
  if (typeof code === "string" && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (error?.response?.status === 401) return ERROR_MESSAGES.UNAUTHORIZED;
  if (error?.response?.status === 429) return ERROR_MESSAGES.SLOW_DOWN;
  if (error?.code === "ERR_NETWORK") return "Cannot reach the server. Is the backend running?";
  return fallback;
}

/** Toast code uses React context; never evaluate it on the server. */
async function showBattleError(title: string, description: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { addToast } = await import("@/lib/toast");
    addToast({ title, description, color: "danger" });
  } catch (error) {
    console.warn("Could not display battle message:", error);
  }
}

export type CreateBattleRequest = {
  fundingPercentage?: number;
  affiliateCode?: string;
  type: "SOLO" | "TEAM";
  mode: "CLASSIC" | "SHARED" | "POINT_RUSH" | "JACKPOT" | "ELIMINATION";
  maxPlayers: number;
  teamSize?: number | null;
  teamCount?: number | null;
  fastBattle?: boolean;
  lastChance?: boolean;
  upsideDown?: boolean;
  rounds: Array<{ packId: string; opensPerParticipant?: number }>;
};

/**
 * POST /battles/create
 * The old backend supports: Classic (standard) and Share (group) modes,
 * solo 2/3/4 players, team 2v2 and 2v2v2, share 2-4 players.
 * Anything else gets a clear message instead of failing silently.
 */
export async function createBattle(input: CreateBattleRequest): Promise<{ id: string }> {

  if (input.mode === "ELIMINATION") throw new Error("Elimination mode is not available yet.");
  if (input.mode === "POINT_RUSH") throw new Error("This mode is not available yet.");

  if (input.lastChance) throw new Error("Last Chance is not available yet. Turn it off to continue.");
  if (input.upsideDown) throw new Error("Upside Down is not available yet. Turn it off to continue.");

  let gamemode: "standard" | "group" | "jackpot";
  let teams: number;
  let playersPerTeam: number;

  if (input.mode === "SHARED") {
    // Share mode: everybody in ONE team and they share the pot
    if (input.type !== "SOLO") throw new Error("Share mode is only available for solo battles.");
    if (![2, 3, 4].includes(input.maxPlayers)) {
      throw new Error("Share mode supports 2, 3 or 4 players.");
    }
    gamemode = "group";
    teams = 1;
    playersPerTeam = input.maxPlayers;
  } else if (input.type === "SOLO") {
    if (![2, 3, 4].includes(input.maxPlayers)) {
      throw new Error("Solo battles support 2, 3 or 4 players right now.");
    }
    gamemode = "standard";
    teams = input.maxPlayers;
    playersPerTeam = 1;
  } else {
    const size = Number(input.teamSize);
    const count = Number(input.teamCount);
    if (size !== 2 || (count !== 2 && count !== 3)) {
      throw new Error("Team battles support 2v2 and 2v2v2 right now.");
    }
    gamemode = "standard";
    teams = count;
    playersPerTeam = size;
  }

  const cases = (input.rounds || []).map((r) => Number(r.packId));
  if (cases.length === 0) throw new Error("Please select at least one pack.");
  if (cases.some((id) => !Number.isInteger(id))) {
    throw new Error("One of the selected packs is not valid.");
  }
  if ((input.rounds || []).some((r) => (r.opensPerParticipant ?? 1) !== 1)) {
    throw new Error("Only one opening per pack is supported.");
  }

  let response;
  try {
    const { apiClient } = await import("./client");
    response = await apiClient.post<{ success: boolean; battleId: number | string }>(
      "/battles/create",
      {
        cases,
        gamemode:input.mode==="JACKPOT"?"jackpot":gamemode,
        fastBattle:input.fastBattle===true,
        teams,
        playersPerTeam,
        funding: input.fundingPercentage??0,
        affiliateCode:input.affiliateCode||undefined,
        minLvl: 0,
        isPrivate: false,
      }
    );
  } catch (error: any) {
    console.warn("Error creating battle:", error);
    throw new Error(getErrorMessage(error, "Failed to create battle. Please try again."));
  }

  const battleId = response.data?.battleId;
  if (battleId == null) throw new Error("Invalid response from server");
  return { id: String(battleId) };
}

/**
 * POST /battles/:id/join { slot }
 * On failure it shows a message and returns null (the page just refreshes).
 */
export async function joinBattle(battleId: string, seatIndex?: number): Promise<any> {
  try {
    let slot: number;
    if (typeof seatIndex === "number") {
      slot = seatIndex + 1;
    } else {
      const latest = await getBattleById(battleId);
      const free = latest?.players.find((p) => !p.participantId);
      if (!free || free.seatIndex == null) throw new Error("There is no free seat in this battle.");
      slot = free.seatIndex + 1;
    }

    const pk = getPrivKeyFromUrl();
    const { apiClient } = await import("./client");
    const res = await apiClient.post(`/battles/${battleId}/join`, {
      slot,
      ...(pk ? { privKey: pk } : {}),
    });
    return res.data;
  } catch (error: any) {
    console.warn("Could not join battle:", error);
    await showBattleError(
      "Could not join the battle",
      error?.response ? getErrorMessage(error, "Please try again.") : error?.message ?? "Please try again."
    );
    return null;
  }
}

/**
 * POST /battles/:id/bot { slot }  (only the creator can do this)
 * On failure it shows a message and returns null.
 */
export async function inviteBot(battleId: string, seatIndex: number): Promise<any> {
  try {
    const { apiClient } = await import("./client");
    const res = await apiClient.post(`/battles/${battleId}/bot`, { slot: seatIndex + 1 });
    return res.data;
  } catch (error: any) {
    console.warn("Could not add bot:", error);
    await showBattleError(
      "Could not add the bot",
      getErrorMessage(error, "Please try again.")
    );
    return null;
  }
}

export async function cancelBattle(id:string){const {apiClient}=await import('./client');try{return(await apiClient.post('/battles/'+encodeURIComponent(id)+'/cancel')).data;}catch(e:any){const messages:Record<string,string>={OTHER_PLAYERS_JOINED:'Another player has joined. This battle can no longer be cancelled.',BATTLE_ALREADY_STARTED:'This battle has already started.',FORBIDDEN:'Only the creator can cancel.',LEGACY_BATTLE_NOT_CANCELLABLE:'This older battle cannot be cancelled automatically.'};throw new Error(messages[e?.response?.data?.error]||'Could not cancel this battle. Please refresh.');}}
