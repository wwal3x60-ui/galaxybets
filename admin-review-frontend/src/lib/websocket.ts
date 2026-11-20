import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth.store';
import type { BackendBattle, Battle } from './api/battles';
import { buildRoundRolls } from './api/battle-protocol';

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';

/**
 * WebSocket event types
 */
export interface DepositStatusUpdatedEvent {
  depositId: string;
  status: string;
  amount: string;
  metadata?: Record<string, any>;
}

export interface DepositProcessingEvent {
  depositId: string;
  amount: string;
  status: 'PROCESSING';
}

export interface DepositCompletedEvent {
  depositId?: string;
  intentId: string;
  amount: string;
  transactionHash: string;
  status: 'COMPLETED';
}

export interface DepositFailedEvent {
  depositId?: string;
  intentId: string;
  amount: string;
  error: string;
  status: 'FAILED';
}

export interface WalletBalanceUpdatedEvent {
  amount?: string;
  type?: string;
  balance?: string;
  walletBalance?: string;
}

export interface CartUpdatedEvent {
  cartCount?: number;
  reason?: 'PACK_OPEN' | 'REWARD' | 'SELL' | 'SHIP' | 'OTHER';
}

export interface BattleParticipantJoinedEvent {
  battleId: string;
  participant: {
    id: string;
    kind: 'HUMAN' | 'BOT';
    botName?: string | null;
    seatIndex: number;
    teamIndex?: number | null;
    user?: { id: string; username: string; avatar?: string | null } | null;
  } | null;
}

export interface BattleCountdownStartedEvent {
  battleId: string;
  startsAt: string;
}

export interface BattleStartedEvent {
  battleId: string;
  serverSeedHash?: string | null;
  startedAt?: string;
}

export interface BattleRoundResolvedEvent {
  battleId: string;
  roundIndex: number;
  rolls: Array<{
    participantId: string;
    value: string;
    packReward:
      | {
          id: string;
          name: string;
          value: string;
          imageUrl: string | null;
          description: string | null;
          metadata?: { probability?: number; normalizedWeight?: number };
        }
      | null;
  }>;
  participantTotals?: Array<{ participantId: string; totalValue: string; points: number; eliminatedAtRound: number | null }>;
  eliminated?: string[];
  eliminationTiebreak?: null | {
    type: "participant" | "team";
    roundIndex: number;
    nonce: number;
    ticket: number;
    ranges:
      | Array<{ participantId: string; start: number; end: number }>
      | Array<{ teamIndex: number; start: number; end: number }>;
    eliminatedParticipantId?: string;
    eliminatedTeamIndex?: number;
    clientSeeds?: string[];
    combinedClientSeed?: string;
  };
}

export interface BattleCompletedEvent {
  battleId: string;
  winnerId: string | null;
  winnerTeamIndex: number | null;
  jackpotWinnerId: string | null;
}

export interface BattleSettledEvent {
  battleId: string;
  alreadySettled?: boolean;
}

export interface BattleSnapshotEvent {
  battleId: string;
  battle: any | null;
}

export interface BattleHighlightItem {
  id: string;
  mode: string;
  modeColor: string;
  players: Array<{ avatar: string; name: string }>;
  packs: Array<{ name: string; image: string }>;
  cost: string;
  unboxed: string;
  gradient?: string;
  createdAt?: string;
}

export interface BattleNewEvent {
  battle: BattleHighlightItem;
}

export interface UpgradeHighlightItem {
  id: string;
  upgradedAt: string;
  name: string;
  price: string;
  multiplier: string;
  image: string;
  user: { avatar: string; name: string };
}

export interface UpgradeNewEvent {
  item: UpgradeHighlightItem;
}

export interface LiveOpenItem {
  id: string;
  openedAt: string;
  name: string;
  price: string;
  image: string;
  user: { avatar: string; name: string };
}

export interface LiveOpenNewEvent {
  item: LiveOpenItem;
}

export type WebSocketConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketStatusSnapshot {
  state: WebSocketConnectionState;
  connected: boolean;
  socketId: string | null;
  transport: string | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  lastError: string | null;
  updatedAt: number;
}

export interface WebSocketHandlers {
  onDepositStatusUpdated?: (data: DepositStatusUpdatedEvent) => void;
  onDepositProcessing?: (data: DepositProcessingEvent) => void;
  onDepositCompleted?: (data: DepositCompletedEvent) => void;
  onDepositFailed?: (data: DepositFailedEvent) => void;
  onWalletBalanceUpdated?: (data: WalletBalanceUpdatedEvent) => void;
  onCartUpdated?: (data: CartUpdatedEvent) => void;
  onBattleParticipantJoined?: (data: BattleParticipantJoinedEvent) => void;
  onBattleCountdownStarted?: (data: BattleCountdownStartedEvent) => void;
  onBattleStarted?: (data: BattleStartedEvent) => void;
  onBattleRoundResolved?: (data: BattleRoundResolvedEvent) => void;
  onBattleCompleted?: (data: BattleCompletedEvent) => void;
  onBattleSettled?: (data: BattleSettledEvent) => void;
  onBattleSnapshot?: (data: BattleSnapshotEvent) => void;
  onBattleNew?: (data: BattleNewEvent) => void;
  onLiveOpenNew?: (data: LiveOpenNewEvent) => void;
  onUpgradeNew?: (data: UpgradeNewEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

/**
 * OLD GalaxyBets backend: battle snapshots we have seen (used to turn the
 * old live events into the events the battle pages understand).
 */
const oldBattleCache = new Map<string, any>();
function rememberBattle(id: string, snap: any): void {
  oldBattleCache.set(id, snap);
  if (oldBattleCache.size > 50) {
    const oldest = oldBattleCache.keys().next().value;
    if (oldest !== undefined) oldBattleCache.delete(oldest);
  }
}

function getPrivKeyFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get('pk');
  } catch {
    return null;
  }
}

class WebSocketManager {
  private socket: Socket | null = null;
  private handlers: WebSocketHandlers = {};
  private currentToken: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private retryLater(): void {
    if (this.retryTimer !== null || !this.socket) return;
    const socket = this.socket;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.socket !== socket || socket.connected) return;
      this.reconnectAttempts = 0;
      this.setStatus({ state: 'connecting', connected: false, reconnectAttempts: 0 });
      socket.connect();
    }, 10000);
  }
  private status: WebSocketStatusSnapshot = {
    state: 'disconnected',
    connected: false,
    socketId: null,
    transport: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    lastError: null,
    updatedAt: Date.now(),
  };
  private statusListeners = new Set<(s: WebSocketStatusSnapshot) => void>();

  private setStatus(patch: Partial<WebSocketStatusSnapshot>): void {
    this.status = {
      ...this.status,
      ...patch,
      connected: Boolean(patch.connected ?? this.status.connected),
      updatedAt: Date.now(),
    };
    for (const cb of this.statusListeners) cb(this.status);
  }

  connect(token?: string): void {
    const nextToken = typeof token === "string" && token.trim().length > 0 ? token.trim() : null;

    if (this.socket && this.currentToken === nextToken) {
      if (!this.socket.connected && (!this.socket.active || this.retryTimer !== null)) {
        this.clearRetryTimer();
        this.socket.connect();
      }
      return;
    }
    if (this.socket) this.disconnect();
    this.currentToken = nextToken;

    // Local development uses the backend port; production defaults to the same HTTPS origin.
    const configuredUrl = process.env.NEXT_PUBLIC_SOCKET_URL?.trim();
    const localHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
    const apiUrl = configuredUrl || (localHost ? 'http://127.0.0.1:3001' : window.location.origin);
    
    const socketUrl = apiUrl;

    if (isDev) console.log('[WebSocket] Connecting to:', socketUrl);

    this.setStatus({
      state: 'connecting',
      connected: false,
      lastError: null,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      socketId: null,
      transport: null,
    });

    this.socket = io(socketUrl, {
      path: '/socket.io',
      ...(nextToken ? { auth: { token: nextToken } } : {}),
      transports: ['polling', 'websocket'],
      tryAllTransports: true,
      reconnection: true,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.clearRetryTimer();
      if (isDev) console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.setStatus({
        state: 'connected',
        connected: true,
        reconnectAttempts: this.reconnectAttempts,
        socketId: this.socket?.id ?? null,
        transport: (this.socket as any)?.io?.engine?.transport?.name ?? null,
        lastError: null,
      });
      // The old backend only logs the socket in when it receives an 'auth' message with the token.
      if (this.currentToken) this.socket?.emit('auth', this.currentToken);
      this.handlers.onConnect?.();
    });

    this.socket.on('disconnect', (reason) => {
      if (isDev) console.log('[WebSocket] Disconnected:', reason);
      this.setStatus({
        state: 'disconnected',
        connected: false,
        socketId: this.socket?.id ?? null,
        transport: (this.socket as any)?.io?.engine?.transport?.name ?? null,
      });
      this.handlers.onDisconnect?.();
      if (reason === 'io server disconnect') this.retryLater();
    });

    this.socket.on('connect_error', (error) => {
      // The status panel reports temporary outages without a blocking Next overlay.
      if (isDev) console.warn('[WebSocket] Backend connection unavailable:', error.message);
      this.reconnectAttempts++;
      this.setStatus({
        state: 'error',
        connected: false,
        reconnectAttempts: this.reconnectAttempts,
        maxReconnectAttempts: this.maxReconnectAttempts,
        lastError: error?.message ?? String(error),
        socketId: this.socket?.id ?? null,
        transport: (this.socket as any)?.io?.engine?.transport?.name ?? null,
      });
      if (!this.socket?.active) this.retryLater();
    });

    this.socket.io.on('reconnect_failed', () => {
      this.setStatus({ state: 'error', connected: false, lastError: 'Backend unavailable. Retrying shortly.' });
      this.retryLater();
    });

    this.socket.on('deposit:status-updated', (data: DepositStatusUpdatedEvent) => this.handlers.onDepositStatusUpdated?.(data));
    this.socket.on('deposit:processing', (data: DepositProcessingEvent) => this.handlers.onDepositProcessing?.(data));
    this.socket.on('deposit:completed', (data: DepositCompletedEvent) => this.handlers.onDepositCompleted?.(data));
    this.socket.on('deposit:failed', (data: DepositFailedEvent) => this.handlers.onDepositFailed?.(data));
    this.socket.on('wallet:balance-updated', (data: WalletBalanceUpdatedEvent) => this.handlers.onWalletBalanceUpdated?.(data));
    this.socket.on('cart:updated', (data: CartUpdatedEvent) => this.handlers.onCartUpdated?.(data));
    this.socket.on('battle:participant_joined', (data: BattleParticipantJoinedEvent) => this.handlers.onBattleParticipantJoined?.(data));
    this.socket.on('battle:snapshot', (data: BattleSnapshotEvent) => this.handlers.onBattleSnapshot?.(data));
    this.socket.on('battle:countdown_started', (data: BattleCountdownStartedEvent) => this.handlers.onBattleCountdownStarted?.(data));
    this.socket.on('battle:started', (data: BattleStartedEvent) => this.handlers.onBattleStarted?.(data));
    this.socket.on('battle:round_resolved', (data: BattleRoundResolvedEvent) => this.handlers.onBattleRoundResolved?.(data));
    this.socket.on('battle:completed', (data: BattleCompletedEvent) => this.handlers.onBattleCompleted?.(data));
    this.socket.on('battle:settled', (data: BattleSettledEvent) => this.handlers.onBattleSettled?.(data));
    this.socket.on('battle:new', (data: BattleNewEvent) => this.handlers.onBattleNew?.(data));
    this.socket.on('live-open:new', (data: LiveOpenNewEvent) => this.handlers.onLiveOpenNew?.(data));
    this.socket.on('upgrade:new', (data: UpgradeNewEvent) => this.handlers.onUpgradeNew?.(data));
    this.socket.on('pong', () => {});

    this.setupOldBackendHandlers();
  }

  /**
   * Translates the OLD backend's live events into the event shapes the pages use.
   *  battle (full snapshot) / battle:join / battle:start / battle:round / battle:ended
   *  battles:push / battles:join / battles:round / battles:ended  (lobby)
   *  balance ('set' | 'add')
   */
  private setupOldBackendHandlers(): void {
    const s = this.socket;
    if (!s) return;

    // --- Battle room ---
    s.on('battle', (snap: any) => {
      if (!snap || snap.id == null) return;
      const id = String(snap.id);
      rememberBattle(id, snap);
      this.handlers.onBattleSnapshot?.({ battleId: id, battle: snap });
    });

    s.on('battle:join', (battleId: any, player: any) => {
      const id = String(battleId);
      const snap = oldBattleCache.get(id);
      if (snap && player) {
        snap.players = [...(snap.players || []).filter((p: any) => p.slot !== player.slot), player];
      }
      this.handlers.onBattleParticipantJoined?.({ battleId: id, participant: null });
    });

    s.on('battle:start', (battleId: any, rounds: any, clientSeed: any, serverSeed: any) => {
      const id = String(battleId);
      const startedAt = new Date().toISOString();
      const snap = oldBattleCache.get(id);
      if (snap) {
        snap.rounds = rounds;
        snap.clientSeed = clientSeed;
        snap.serverSeed = serverSeed;
        snap.startedAt = snap.startedAt ?? startedAt;
      }
      this.handlers.onBattleStarted?.({ battleId: id, serverSeedHash: null, startedAt });
    });

    s.on('battle:round', (battleId: any, round: any) => {
      const id = String(battleId);
      const snap = oldBattleCache.get(id);
      if (!snap) return;
      snap.round = Number(round);
      const roundIndex = Number(round) - 1;
      const rolls = buildRoundRolls(snap, roundIndex);
      if (!rolls) return;
      this.handlers.onBattleRoundResolved?.({ battleId: id, roundIndex, rolls });
    });

    s.on('battle:ended', (battleId: any, info: any) => {
      const id = String(battleId);
      const winnerTeam = info?.winnerTeam ?? null;
      const snap = oldBattleCache.get(id);
      if (snap) {
        snap.winnerTeam = winnerTeam;
        if(info?.jackpotMeta)snap.jackpotMeta=info.jackpotMeta;
        snap.endedAt = new Date().toISOString();
      }
      this.handlers.onBattleCompleted?.({
        battleId: id,
        winnerId: null,
        winnerTeamIndex: winnerTeam != null ? Number(winnerTeam) - 1 : null,
        jackpotWinnerId: null,
      });
      this.handlers.onBattleSettled?.({ battleId: id });
    });

    // --- Lobby: tell the list to reload that one battle (debounced) ---
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const touchLobby = (battleId: any) => {
      if (battleId == null) return;
      const id = String(battleId);
      const existing = timers.get(id);
      if (existing) clearTimeout(existing);
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          this.handlers.onBattleNew?.({ battle: { id } as any });
        }, 300)
      );
    };
    // A list with several battles is the answer to our own request; a single one is a NEW battle.
    s.on('battles:push', (list: any) => {
      if (Array.isArray(list) && list.length === 1) touchLobby(list[0]?.id);
    });
    s.on('battles:join', (battleId: any) => touchLobby(battleId));
    s.on('battles:round', (battleId: any) => touchLobby(battleId));
    s.on('battles:ended', (battleId: any) => touchLobby(battleId));
    s.on('battles:cancelled',(id:any)=>touchLobby(id));
    s.on('battle:cancelled',(id:any)=>{const snap=oldBattleCache.get(String(id));if(snap){snap.cancelledAt=new Date().toISOString();snap.endedAt=snap.cancelledAt;}this.handlers.onBattleSettled?.({battleId:String(id)});});

    // --- Live balance ---
    s.on('balance', (kind: any, amount: any) => {
      try {
        const store = useAuthStore.getState();
        if (!store.user) return;
        const value = Number(amount);
        if (!Number.isFinite(value)) return;
        const current = Number(store.user.balance ?? store.user.walletBalance ?? 0) || 0;
        const next = Math.round((kind === 'add' ? current + value : value) * 100) / 100;
        store.updateUser({ balance: next, walletBalance: String(next) });
        this.handlers.onWalletBalanceUpdated?.({ balance: String(next), walletBalance: String(next) });
      } catch {
        // ignore
      }
    });
  }

  disconnect(): void {
    this.clearRetryTimer();
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.io.removeAllListeners('reconnect_failed');
      this.socket.disconnect();
      this.socket = null;
      this.reconnectAttempts = 0;
      this.currentToken = null;
      this.setStatus({
        state: 'disconnected',
        connected: false,
        reconnectAttempts: 0,
        socketId: null,
        transport: null,
        lastError: null,
      });
      if (isDev) console.log('[WebSocket] Disconnected');
    }
  }

  setHandlers(handlers: WebSocketHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getStatus(): WebSocketStatusSnapshot {
    return this.status;
  }

  subscribeStatus(listener: (s: WebSocketStatusSnapshot) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }
}

export const websocketManager = new WebSocketManager();

export function initializeWebSocket(token: string): void {
  websocketManager.connect(token);
}

export function initializePublicWebSocket(): void {
  websocketManager.connect();
}

export function disconnectWebSocket(): void {
  websocketManager.disconnect();
}

export function useWebSocket(handlers: WebSocketHandlers) {
  websocketManager.setHandlers(handlers);
  return {
    isConnected: websocketManager.isConnected(),
    socket: websocketManager.getSocket(),
  };
}

export function battleJoinRoom(battleId: string): void {
  const socket = websocketManager.getSocket();
  if (!socket) return;
  // Old backend: subscribing to a battle id joins its room and returns the full battle.
  socket.emit('battles:subscribe', Number.isFinite(Number(battleId)) ? Number(battleId) : battleId, getPrivKeyFromUrl());
}

export function battleLeaveRoom(battleId: string): void {
  const socket = websocketManager.getSocket();
  if (!socket) return;
  socket.emit('battles:unsubscribe', Number.isFinite(Number(battleId)) ? Number(battleId) : battleId);
}

export function getWebSocketStatusSnapshot(): WebSocketStatusSnapshot {
  return websocketManager.getStatus();
}

export function subscribeWebSocketStatus(listener: (s: WebSocketStatusSnapshot) => void): () => void {
  return websocketManager.subscribeStatus(listener);
}

/** Raw events from the existing Jackpot backend. No timer or bot simulation. */
export interface JackpotSocketHandlers {
  onConnection?: (connected: boolean) => void;
  onSync?: () => void;
  onSet?: (snapshot: unknown) => void;
  onTick?: (seconds: unknown) => void;
  onBets?: (bets: unknown) => void;
  onRoll?: (...args: unknown[]) => void;
  onReset?: () => void;
  onNewRound?: (round: unknown) => void;
  onAmount?: (amount: unknown) => void;
  onCommit?: (block: unknown) => void;
}

export function subscribeJackpot(handlers: JackpotSocketHandlers, token?: string): { resync: () => void; unsubscribe: () => void } {
  let active = true;
  let attached: ReturnType<typeof websocketManager.getSocket> = null;
  let detach = () => {};
  let wasConnected = false;
  const request = () => {
    if (!active || !attached?.connected) return;
    handlers.onSync?.();
    attached.emit("jackpot:subscribe");
  };
  const offStatus = websocketManager.subscribeStatus((status) => {
    if (!active) return;
    if (!status.connected) {
      wasConnected = false;
      handlers.onConnection?.(false);
      return;
    }
    const socket = websocketManager.getSocket();
    if (!socket) return;
    if (attached !== socket) {
      detach(); attached = socket; wasConnected = false;
      const set = (data: unknown) => handlers.onSet?.(data);
      const tick = (data: unknown) => handlers.onTick?.(data);
      const bets = (data: unknown) => handlers.onBets?.(data);
      const roll = (...args: unknown[]) => handlers.onRoll?.(...args);
      const reset = () => handlers.onReset?.();
      const next = (data: unknown) => handlers.onNewRound?.(data);
      const amount = (data: unknown) => handlers.onAmount?.(data);
      const commit = (data: unknown) => handlers.onCommit?.(data);
      socket.on("jackpot:set", set); socket.on("jackpot:tick", tick); socket.on("jackpot:bets", bets);
      socket.on("jackpot:roll", roll); socket.on("jackpot:reset", reset);
      socket.on("jackpot:newRound", next); socket.on("jackpot:new", next);
      socket.on("jackpot:amount", amount); socket.on("jackpot:commit", commit);
      detach = () => {
        socket.off("jackpot:set", set); socket.off("jackpot:tick", tick); socket.off("jackpot:bets", bets);
        socket.off("jackpot:roll", roll); socket.off("jackpot:reset", reset);
        socket.off("jackpot:newRound", next); socket.off("jackpot:new", next);
        socket.off("jackpot:amount", amount); socket.off("jackpot:commit", commit);
      };
    }
    if (!wasConnected) { wasConnected = true; handlers.onConnection?.(true); request(); }
  });
  websocketManager.connect(token);
  return {
    resync: request,
    unsubscribe: () => {
      if (!active) return;
      active = false; offStatus(); detach();
      if (attached?.connected) attached.emit("jackpot:unsubscribe");
      // The shared socket remains connected for the rest of the site.
    },
  };
}

/** Existing Coinflip protocol. This subscribes to the backend lobby only. */
export interface CoinflipSocketHandlers {
  onConnection?: (connected: boolean) => void;
  onSync?: () => void;
  onPush?: (games: unknown, serverTime: unknown, snapshot: boolean) => void;
  onJoin?: (id: unknown, side: unknown, user: unknown) => void;
  onCommit?: (id: unknown, block: unknown) => void;
  onStarted?: (id: unknown, clientSeed: unknown, serverSeed: unknown, side: unknown) => void;
  onOwnStarted?: (game: unknown) => void;
}
export function subscribeCoinflips(handlers: CoinflipSocketHandlers, token?: string): { resync: () => void; unsubscribe: () => void } {
  let active = true;
  let attached: ReturnType<typeof websocketManager.getSocket> = null;
  let detach = () => {};
  let wasConnected = false;
  let awaitingSnapshot = false;
  const request = () => {
    if (!active || !attached?.connected) return;
    awaitingSnapshot = true; handlers.onSync?.(); attached.emit("coinflip:subscribe");
  };
  const offStatus = websocketManager.subscribeStatus((status) => {
    if (!active) return;
    if (!status.connected) { wasConnected = false; handlers.onConnection?.(false); return; }
    const socket = websocketManager.getSocket(); if (!socket) return;
    if (attached !== socket) {
      detach(); attached = socket; wasConnected = false;
      const push = (games: unknown, serverTime: unknown) => { const snapshot = awaitingSnapshot; awaitingSnapshot = false; handlers.onPush?.(games, serverTime, snapshot); };
      const join = (id: unknown, side: unknown, user: unknown) => handlers.onJoin?.(id, side, user);
      const commit = (id: unknown, block: unknown) => handlers.onCommit?.(id, block);
      const started = (id: unknown, clientSeed: unknown, serverSeed: unknown, side: unknown) => handlers.onStarted?.(id, clientSeed, serverSeed, side);
      const own = (game: unknown) => handlers.onOwnStarted?.(game);
      socket.on("coinflips:push", push); socket.on("coinflip:join", join); socket.on("coinflip:commit", commit); socket.on("coinflip:started", started); socket.on("coinflip:own:started", own);
      detach = () => { socket.off("coinflips:push", push); socket.off("coinflip:join", join); socket.off("coinflip:commit", commit); socket.off("coinflip:started", started); socket.off("coinflip:own:started", own); };
    }
    if (!wasConnected) { wasConnected = true; handlers.onConnection?.(true); request(); }
  });
  websocketManager.connect(token);
  return { resync: request, unsubscribe: () => { if (!active) return; active = false; offStatus(); detach(); if (attached?.connected) attached.emit("coinflip:unsubscribe"); } };
}
