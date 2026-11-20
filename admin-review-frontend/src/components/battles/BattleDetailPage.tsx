"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Icon } from "@/components/ui/Icon";
import { Image, Button, Link } from "@heroui/react";
import {
  type Battle,
  getBattleById,
  getBattleFormat,
  inviteBot,
  cancelBattle,
  isTeamBattle,
  joinBattle,
  mapBackendBattleToBattle,
} from "@/lib/api/battles";
import { useEffect, useMemo, useState, useRef } from "react";
import PackDrawingView, { PackDrawingViewHandle } from "../packs/PackDrawingView";
import { getPackDetails, type PackDetails } from "@/lib/api/packs";
import { cn } from "@/lib/utils/cn";
import { cleanNumber, formatCurrency, formatPercent } from "@/lib/utils/numbers";
import { getCartItems } from "@/lib/api/cart";
import { fireBattleCelebration } from "@/lib/confetti";
import { preloadPackItemImages } from "@/lib/image-preload";
import { playBasicWin, playSpecialWin, playTick, unlockAudio } from "@/lib/audio";
import { useAuthStore } from "@/store/auth.store";
import { battleJoinRoom, battleLeaveRoom, subscribeWebSocketStatus, useWebSocket } from "@/lib/websocket";
import { useSpinStore } from "@/store/spin.store";
import { type PackItem } from "@/lib/api/packs";
import { websocketManager } from "@/lib/websocket";
import BattleDropCard from "./BattleDropCard";
import BattleResults from "./BattleResults";
import BattleTicketRng from "./BattleTicketRng";
import { canStartBattleTicketReveal } from "@/lib/utils/battle-ticket-rng";
import { useModalStore } from "@/store/modal.store";

interface BattleDetailPageProps {
  battle: Battle;
}

function getBattlePlayerAvatar(player?: Battle["players"][number]): string {
  return player?.avatar || "/assets/avatar/dummy.png";
}

function BannedItemMaskIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 50 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M21.0985 2.3155C22.7065 -0.771551 27.2943 -0.771588 28.9022 2.3155L49.5341 41.9385C50.9837 44.7238 48.8759 47.9998 45.6327 48.0001H4.36804C1.12569 48 -0.983697 44.7238 0.465694 41.9385L21.0985 2.3155ZM24.9999 2.86921C24.7442 2.86927 24.1149 2.94132 23.7723 3.5987L3.13952 43.2218C2.84192 43.7935 3.04991 44.2713 3.20007 44.505C3.35032 44.7387 3.70289 45.1299 4.36804 45.13H45.6327C46.2982 45.1298 46.6493 44.7379 46.7997 44.505C46.9499 44.2721 47.158 43.7936 46.8602 43.2218L26.2284 3.5987C25.8857 2.94083 25.2553 2.86921 24.9999 2.86921ZM24.9999 4.50007C25.1984 4.50009 25.4684 4.56501 25.6298 4.8741L45.6327 43.0001C45.7491 43.2237 45.7386 43.4454 45.6014 43.6583C45.4642 43.8711 45.2624 43.9786 45.0018 43.9786H4.99792C4.73747 43.9786 4.53649 43.871 4.39929 43.6583C4.26208 43.4453 4.25159 43.2238 4.36804 43.0001L24.37 4.8741C24.5314 4.56503 24.8014 4.5001 24.9999 4.50007ZM24.9989 27.3477L20.3993 23.0274L17.203 26.0303L21.8026 30.3507L17.202 34.6729L20.3983 37.6759L24.9989 33.3536L29.6005 37.6768L32.7977 34.6739L28.1952 30.3507L32.7967 26.0294L29.6005 23.0264L24.9989 27.3477Z"
        fill="currentColor"
      />
    </svg>
  );
}

function BannedUserMaskIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="20" cy="20" r="19" stroke="currentColor" strokeWidth="2" />
      <line x1="6.67941" y1="7.26624" x2="33.6794" y2="32.2662" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}


export default function BattleDetailPage({ battle }: BattleDetailPageProps) {
  const router = useRouter();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const { open } = useModalStore();
  const [battleState, setBattleState] = useState<Battle>(battle);
  const battleStateRef = useRef<Battle>(battle);
  const startedAsCompletedRef = useRef<boolean>(battle.status === "completed");
  const jackpotReplayPendingRef = useRef(false);
  const [isRecreating, setIsRecreating] = useState(false);
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [playbackCountdownSeconds, setPlaybackCountdownSeconds] = useState<number | null>(null);
  const [playbackStatusText, setPlaybackStatusText] = useState<string | null>(null);
  const stopPlaybackRef = useRef(false);
  const [joiningSeatIndex, setJoiningSeatIndex] = useState<number | null>(null);
  const [invitingBotSeatIndex, setInvitingBotSeatIndex] = useState<number | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  // Tracks the most recent round whose spin has fully completed (all relevant seats finished).
  // Used to time ELIMINATION masks so they appear after the elimination round reveals.
  const [lastRevealedRoundIndex, setLastRevealedRoundIndex] = useState(-1);
  type SpinQueueItem = { roundIndex: number; seatIndices: number[] };
  const [pendingSpinRound, setPendingSpinRound] = useState<SpinQueueItem | null>(null);
  const [openedBySeat, setOpenedBySeat] = useState<Record<number, Array<PackItem | null>>>({});
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  // Round results should only be committed to UI after slot animation ends.
  const [pendingRoundResults, setPendingRoundResults] = useState<Record<number, Record<number, PackItem | null>>>({});
  const pendingRoundResultsRef = useRef<Record<number, Record<number, PackItem | null>>>({});
  const spinQueueRef = useRef<SpinQueueItem[]>([]);
  const receivedRoundIndicesRef = useRef<Set<number>>(new Set());
  const activeSpinRef = useRef<{ roundIndex: number; remaining: number; seatIndices: number[]; resolve?: () => void } | null>(null);
  const [packDetailsById, setPackDetailsById] = useState<Record<string, PackDetails>>({});
  const packRequestsRef = useRef<Map<string, Promise<PackDetails>>>(new Map());
  const [jackpotFinished, setJackpotFinished] = useState(battle.mode === "JACKPOT" && battle.status === "completed");
  const [jackpotRevealStarted, setJackpotRevealStarted] = useState(false);
  const jackpotRevealOpenedRef = useRef(false);
  const eliminationTiebreakShownRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    battleStateRef.current = battleState;
  }, [battleState]);

  // Create refs for each player's PackDrawingView
  const packDrawingViewRefs = useRef<(PackDrawingViewHandle | null)[]>([]);

  // Full battle snapshots already contain the items from the battle's case
  // version. Only fall back to the catalog when those items are missing.
  // Depend on stable ids so room updates cannot cancel an unchanged request.
  const packFetchKey = JSON.stringify(
    [...new Set((battleState.packs || []).filter((p) => !p.items?.length).map((p) => p.id).filter(Boolean))].sort()
  );
  useEffect(() => {
    const ids: string[] = JSON.parse(packFetchKey);
    if (ids.length === 0) return;
    let cancelled = false;
    const requests = ids.map((id) => {
      const existing = packRequestsRef.current.get(id);
      if (existing) return existing;
      const request = getPackDetails(id).then((response): PackDetails => {
        const details = response?.data as PackDetails | undefined;
        if (!details?.items?.length) throw new Error(`No items returned for case ${id}`);
        return {
          ...details,
          price: typeof details.price === "string" ? details.price : `$${formatCurrency(details.price)}`,
        };
      });
      packRequestsRef.current.set(id, request);
      return request;
    });

    Promise.allSettled(requests).then((results) => {
      // Clear failed requests even after cleanup. A later attempt can retry;
      // successful promises can be reused if an effect is restarted.
      results.forEach((result, index) => {
        if (result.status === "rejected" && packRequestsRef.current.get(ids[index]) === requests[index]) {
          packRequestsRef.current.delete(ids[index]);
          if (!cancelled) console.warn(`Could not load battle case ${ids[index]}:`, result.reason);
        }
      });
      if (cancelled) return;
      if (!results.some((result) => result.status === "fulfilled")) return;
      setPackDetailsById((prev) => {
        const next = { ...prev };
        results.forEach((result, index) => {
          if (result.status === "fulfilled") next[ids[index]] = result.value;
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [packFetchKey]);

  // Preload all pack item images when pack details are available so slot reels show them without delay
  useEffect(() => {
    const allItems: PackItem[] = [];
    battleState.packs.forEach((pack) => {
      if (pack.items?.length) allItems.push(...pack.items);
    });
    Object.values(packDetailsById).forEach((details) => {
      if (details?.items?.length) allItems.push(...details.items);
    });
    if (allItems.length > 0) preloadPackItemImages(allItems);
  }, [packDetailsById, battleState.packs]);

  const currentPack = battleState.packs[currentRoundIndex] ?? battleState.packs[0];
  const currentPackId = currentPack?.id;
  const currentPackDetails = currentPackId ? packDetailsById[currentPackId] : undefined;

  // Convert the *current round pack* to PackDetails format for PackDrawingView.
  // Prefer the items from this battle's snapshot over the current catalog.
  const selectedPacks = useMemo((): PackDetails[] => {
    if (!currentPackId) return [];
    const items = currentPack?.items?.length ? currentPack.items : currentPackDetails?.items ?? [];
    return [
      {
        id: currentPackId,
        name: currentPack?.name ?? currentPackDetails?.name ?? "Case",
        image: currentPack?.image ?? currentPackDetails?.image ?? "/assets/images/pack1.webp",
        items,
        price: currentPackDetails?.price ?? battleState.cost,
        itemCount: items.length,
      },
    ];
  }, [currentPackId, currentPack, currentPackDetails, battleState.cost]);

  // Get battle format string (e.g., "1vs1", "2vs2", "2vs2vs2")
  const battleFormat = getBattleFormat(battleState);
  const isTeam = isTeamBattle(battleState);

  const isPlayerInBattle = !!user?.id && battleState.players.some((p) => p.id === user.id);
  const [cancelling,setCancelling]=useState(false);
  const [cancelError,setCancelError]=useState("");
  const handleCancel=async()=>{if(cancelling)return;setCancelling(true);setCancelError("");try{await cancelBattle(battleState.id);const latest=await getBattleById(battleState.id);if(latest)setBattleState(latest);}catch(e){setCancelError(e instanceof Error?e.message:"Could not cancel.");}finally{setCancelling(false)}};
  const isCreator = !!user?.id && battleState.createdByUserId === user.id;
  const filledWaitingSeats = battleState.players.filter((player) => Boolean(player.participantId)).length;
  const waitingCapacity = battleState.maxPlayers || battleState.playerCount;
  const openWaitingSeats = Math.max(0, waitingCapacity - filledWaitingSeats);

  // Used across battle UI (e.g. jackpot percentage labels)
  const playerColors = ["#eb808b", "#eb808b", "#FF4545", "#F5C542", "#00D1B2", "#FF8C00"];

  const ticketColors = ["#eb808b", "#68c6d6", "#d896b8", "#d6b86b", "#88baa4", "#c3c3c8"];
  const jackpotTicketRanges = useMemo(() => {
    if (battleState.mode !== "JACKPOT") return [];
    const meta = battleState.jackpotMeta;
    if (!meta?.ranges || !Array.isArray(meta.ranges)) return [];

    const orderedRanges = [...meta.ranges].sort((a, b) => a.start - b.start);

    return orderedRanges
      .map((r, idx) => {
        const seatIndex = battleState.players.findIndex((p) => p.participantId === r.participantId);
        const fallbackIndex = seatIndex >= 0 ? seatIndex : idx;
        const label = battleState.players[fallbackIndex]?.name || `Seat ${fallbackIndex + 1}`;
        const avatar = battleState.players[fallbackIndex]?.avatar ?? undefined;
        const color = ticketColors[idx % ticketColors.length];
        return {
          id: r.participantId,
          label,
          color,
          avatar,
          startTicket: r.start,
          endTicket: r.end,
        };
      })
      .filter((s) => Number.isFinite(s.startTicket) && Number.isFinite(s.endTicket) && s.endTicket >= s.startTicket);
  }, [battleState.mode, battleState.jackpotMeta, battleState.players]);

  const jackpotColorByParticipantId = useMemo(() => {
    return new Map(jackpotTicketRanges.map((s) => [s.id, s.color] as const));
  }, [jackpotTicketRanges]);

  const parseMoney = (s?: string) => {
    if (!s) return 0;
    const n = Number(String(s).replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(n) ? cleanNumber(n, 2) : 0;
  };

  const battleTotalCost = parseMoney(battleState.cost) * (battleState.playerCount || 1);

  // If backend finishes faster than our slot animations, keep showing the in-progress
  // animation view until all queued spins have completed locally.
  const hasPendingAnimations =
    activeSpinRef.current != null ||
    spinQueueRef.current.length > 0 ||
    Object.keys(pendingRoundResults).length > 0;

  const effectiveStatus: Battle["status"] =
    battleState.status === "completed" && hasPendingAnimations ? "in_progress" : battleState.status;

  const allPacksOpened = useMemo(() => {
    const packCount = battleState.packs?.length ?? 0;
    const seatCount = battleState.playerCount ?? 0;
    if (packCount <= 0 || seatCount <= 0) return false;

    // Prefer local openedBySeat (live/playback), otherwise fall back to API snapshot.
    const matrix: Record<number, Array<PackItem | null>> | undefined =
      Object.keys(openedBySeat).length > 0 ? openedBySeat : (battleState.resultsBySeat as any);

    if (!matrix) return false;
    for (let s = 0; s < seatCount; s += 1) {
      const row = matrix[s] ?? [];
      if (row.length < packCount) return false;
      // Require all rounds to be present (non-null) for this seat.
      for (let r = 0; r < packCount; r += 1) {
        if (!row[r]) return false;
      }
    }
    return true;
  }, [battleState.packs, battleState.playerCount, battleState.resultsBySeat, openedBySeat]);

  // Direct links show the recorded ticket and result without replaying the reveal.
  // Live completion and replay use the inline ticket reveal.
  useEffect(() => {
    if (battle.mode !== "JACKPOT") return;
    if (battle.status !== "completed") return;
    // Direct-link / initial load: let user see results immediately.
    setJackpotFinished(true);
    jackpotRevealOpenedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finishJackpotReveal = () => {
    jackpotReplayPendingRef.current = false;
    setJackpotFinished(true);
    if (isAuthenticated) {
      getCartItems("AVAILABLE").then((cart) => updateUser({ cartCount: cart?.length })).catch(() => {});
    }
  };

  // Reveal the server-selected ticket inside the arena after all pack reveals finish.
  useEffect(() => {
    const playbackJustEnded = jackpotReplayPendingRef.current && !isPlaybackActive;
    if (!canStartBattleTicketReveal({mode:battleState.mode,status:effectiveStatus,replaying:isPlaybackActive,
      finished:jackpotFinished,started:jackpotRevealOpenedRef.current,packsRevealed:allPacksOpened,
      ticket:battleState.jackpotMeta?.ticket,rangeCount:jackpotTicketRanges.length,
      startedAsCompleted:startedAsCompletedRef.current,playbackJustEnded})) return;
    jackpotRevealOpenedRef.current = true;
    jackpotReplayPendingRef.current = false;
    setJackpotRevealStarted(true);
  }, [battleState.mode, battleState.jackpotMeta?.ticket, effectiveStatus, isPlaybackActive,
      jackpotFinished, jackpotTicketRanges, allPacksOpened]);

  const handleRecreateBattle = async () => {
    if (isRecreating) return;

    setIsRecreating(true);
    try {
      const modeMap: Record<string, "classic" | "share" | "jackpot" | "elimination"> = {
        CLASSIC: "classic",
        SHARED: "share",
        JACKPOT: "jackpot",
        ELIMINATION: "elimination",
      };

      let playerCountStr: string;
      if (battleState.battleType === "team" && battleState.teamCount && battleState.playersPerTeam) {
        playerCountStr =
          battleState.teamCount === 2
            ? `${battleState.playersPerTeam}v${battleState.playersPerTeam}`
            : `${battleState.playersPerTeam}v${battleState.playersPerTeam}v${battleState.playersPerTeam}`;
      } else {
        playerCountStr = String(battleState.playerCount);
      }

      const packCount = battleState.packs.length || 0;
      const perPlayerTotal = parseMoney(battleState.cost);
      const fallbackPerPack = packCount > 0 ? perPlayerTotal / packCount : 0;

      const packDetailsResults = await Promise.allSettled(battleState.packs.map((p) => getPackDetails(p.id)));
      const packs: PackDetails[] = packDetailsResults.map((res, idx) => {
        if (res.status === "fulfilled") return res.value.data;
        const p = battleState.packs[idx];
        return {
          id: p?.id ?? "",
          name: p?.name ?? "Unknown case",
          image: p?.image ?? "/assets/images/pack1.webp",
          price: `$${formatCurrency(fallbackPerPack)}`,
          itemCount: 0,
          items: [],
        };
      });

      const config = {
        battleType: battleState.battleType,
        gameMode: modeMap[battleState.mode] || "classic",
        playerCount: playerCountStr,
        fastBattle: !!battleState.fastBattle,
        lastChance: !!battleState.lastChance,
        upsideDown: !!battleState.upsideDown,
        packs,
      };

      localStorage.setItem("recreateBattleConfig", JSON.stringify(config));
      router.push("/create-battle");
    } finally {
      setIsRecreating(false);
    }
  };

  const winnerSeatIndices = useMemo(() => {
    if (effectiveStatus !== "completed") return new Set<number>();
    if (battleState.mode === "SHARED") return new Set<number>(battleState.players.map((_, i) => i));

    if (battleState.battleType === "team" && battleState.winnerTeamIndex != null) {
      const teamSize = battleState.playersPerTeam ?? 0;
      const effectiveTeamIndex = (player: Battle["players"][number], seatIndex: number) => {
        if (teamSize > 0) return Math.floor(seatIndex / teamSize);
        return null;
      };
      return new Set<number>(
        battleState.players
          .map((p, i) => ({ p, i }))
          .filter(({ p, i }) => effectiveTeamIndex(p, i) === battleState.winnerTeamIndex)
          .map(({ i }) => i)
      );
    }

    const winningParticipantId =
      battleState.mode === "JACKPOT" ? battleState.jackpotWinnerParticipantId : battleState.winnerParticipantId;
    const seat = battleState.players.findIndex((p) => p.participantId && p.participantId === winningParticipantId);
    return new Set<number>(seat >= 0 ? [seat] : []);
  }, [effectiveStatus, battleState.mode, battleState.battleType, battleState.players, battleState.winnerTeamIndex, battleState.playersPerTeam, battleState.jackpotWinnerParticipantId, battleState.winnerParticipantId]);

  const getSeatTotal = (seatIndex: number): number => {
    const items = openedBySeat[seatIndex] || [];
    return items.reduce((sum, it) => {
      if (!it) return sum;
      const v = Number.parseFloat(it.template?.value || "0");
      return sum + (Number.isFinite(v) ? cleanNumber(v, 2) : 0);
    }, 0);
  };

  const getPoolTotal = (): number => {
    return Object.keys(openedBySeat).reduce((sum, k) => sum + getSeatTotal(Number(k)), 0);
  };

  const refreshBattle = async () => {
    const latest = await getBattleById(battleState.id);
    if (latest) setBattleState(latest);
  };

  // Countdown overlay (server-truth via countdownEndsAt)
  useEffect(() => {
    if (effectiveStatus !== "waiting") {
      setCountdownSeconds(null);
      return;
    }
    const endsAt = battleState.countdownEndsAt;
    if (!endsAt) {
      setCountdownSeconds(null);
      return;
    }

    const endsMs = Date.parse(endsAt);
    if (Number.isNaN(endsMs)) {
      setCountdownSeconds(null);
      return;
    }

    const tick = () => {
      const diffMs = endsMs - Date.now();
      const sec = Math.max(0, Math.ceil(diffMs / 1000));
      setCountdownSeconds(sec);
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [battleState.status, battleState.countdownEndsAt]);

  // Play tick on each countdown second (5, 4, 3, 2, 1) before battle starts
  useEffect(() => {
    if (countdownSeconds != null && countdownSeconds >= 1 && countdownSeconds <= 5) {
      playTick();
    }
  }, [countdownSeconds]);

  // When landing on an already completed battle, hydrate per-round results from API payload.
  useEffect(() => {
    if (effectiveStatus !== "completed") return;
    if (Object.keys(openedBySeat).length > 0) return;
    if (!battleState.resultsBySeat) return;
    setOpenedBySeat(battleState.resultsBySeat);
  }, [effectiveStatus, battleState.resultsBySeat, openedBySeat]);

  // If we have hydrated results, set currentRoundIndex to last available round.
  useEffect(() => {
    if (!battleState.resultsBySeat) return;
    if (activeSpinRef.current || spinQueueRef.current.length > 0 || isPlaybackActive) return;
    const maxLen = Math.max(...Object.values(battleState.resultsBySeat).map((arr) => arr?.length ?? 0), 0);
    if (maxLen > 0) setCurrentRoundIndex(Math.max(0, maxLen - 1));
  }, [battleState.resultsBySeat]);

  // In-progress resync: compute current round from server data (no replay)
  useEffect(() => {
    if (effectiveStatus !== "in_progress") return;
    if (activeSpinRef.current || spinQueueRef.current.length > 0 || isPlaybackActive) return;
    const roundsMeta = battleState.roundsMeta || [];
    if (roundsMeta.length === 0) return;

    const firstUnresolved = roundsMeta.find((r) => !r.resolvedAt);
    const idx = firstUnresolved ? firstUnresolved.roundIndex : roundsMeta[roundsMeta.length - 1].roundIndex;
    setCurrentRoundIndex(Math.max(0, idx));

    if (battleState.resultsBySeat && Object.keys(openedBySeat).length === 0) {
      // show static history immediately
      setOpenedBySeat(battleState.resultsBySeat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStatus, battleState.roundsMeta, battleState.resultsBySeat]);

  // Subscribe to this battle room for realtime updates
  useEffect(() => {
    battleJoinRoom(battleState.id);
    return () => battleLeaveRoom(battleState.id);
  }, [battleState.id]);

  // Re-join battle room after websocket reconnects (new socket id)
  useEffect(() => {
    return subscribeWebSocketStatus((s) => {
      if (!s.connected) return;
      battleJoinRoom(battleState.id);
    });
  }, [battleState.id]);

  // Polling fallback: if websocket is disconnected, keep syncing from API
  useEffect(() => {
    const intervalMs = 4000;
    const id = window.setInterval(() => {
      if (battleState.status === "completed") return;
      if (websocketManager.isConnected()) return;
      refreshBattle();
    }, intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleState.id, battleState.status]);

  const setForcedResult = useSpinStore((s) => s.setForcedResult);
  const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  const stopPlayback = () => {
    jackpotReplayPendingRef.current = false;
    stopPlaybackRef.current = true;
    setIsPlaybackActive(false);
    setPlaybackCountdownSeconds(null);
    setPlaybackStatusText(null);
    setPendingSpinRound(null);
    spinQueueRef.current = [];
    activeSpinRef.current = null;
    // Ensure UI returns to completed state immediately (no pending animations).
    setPendingRoundResults({});
    // Drop any partial playback grid so completed view can rely on server snapshot.
    setOpenedBySeat({});
    setLastRevealedRoundIndex(-1);
    // Stopping replay returns to the already-recorded server result.
    setJackpotFinished(true);
  };

  useEffect(() => {
    pendingRoundResultsRef.current = pendingRoundResults;
  }, [pendingRoundResults]);

  const beginRoundSpin = (roundIndex: number, seatIndices: number[], resolve?: () => void) => {
    if (seatIndices.length === 0) { resolve?.(); return; }
    setCurrentRoundIndex(roundIndex);
    activeSpinRef.current = { roundIndex, remaining: seatIndices.length, seatIndices, resolve };
    setPendingSpinRound({ roundIndex, seatIndices });
  };

  const handlePlayback = async () => {
    // Toggle off if already playing.
    if (isPlaybackActive) {
      stopPlayback();
      return;
    }

    // Playback is meant for already-completed battles.
    if (battleState.status !== "completed") return;

    unlockAudio();
    stopPlaybackRef.current = false;
    jackpotReplayPendingRef.current = true;
    setIsPlaybackActive(true);
    // Replay shows the same recorded ticket after its pack reveals finish.
    jackpotRevealOpenedRef.current = false;
    setJackpotRevealStarted(false);
    setJackpotFinished(false);
    setPlaybackStatusText(null);

    // One request only: server-truth result snapshot.
    const latest = (await getBattleById(battleState.id)) ?? battleState;
    setBattleState(latest);

    const results = latest.resultsBySeat;
    const packCount = latest.packs.length || latest.packCount || 0;
    const seatCount = latest.playerCount || latest.maxPlayers || 0;

    if (!results || packCount <= 0 || seatCount <= 0) {
      stopPlayback();
      return;
    }

    // Reset grid state for playback
    setCurrentRoundIndex(0);
    setLastRevealedRoundIndex(-1);
    setOpenedBySeat(() => {
      const next: Record<number, Array<PackItem | null>> = {};
      for (let s = 0; s < seatCount; s += 1) {
        next[s] = Array.from({ length: packCount }).map(() => null);
      }
      return next;
    });

    // Local countdown (optimized: no server tick events); tick sound per second
    setPlaybackCountdownSeconds(5);
    playTick();
    for (let sec = 4; sec >= 1; sec -= 1) {
      if (stopPlaybackRef.current) return stopPlayback();
      await sleep(1000);
      setPlaybackCountdownSeconds(sec);
      playTick();
    }
    await sleep(1000);
    setPlaybackCountdownSeconds(null);
    setPlaybackStatusText("Starting...");
    await sleep(700);
    setPlaybackStatusText(null);

    // Round-by-round playback
    const roundDelayMs = 5000;
    for (let roundIndex = 0; roundIndex < packCount; roundIndex += 1) {
      if (stopPlaybackRef.current) return stopPlayback();

      setCurrentRoundIndex(roundIndex);

      // Force results immediately, but only commit to UI when the spin completes.
      const roundItemsBySeat: Record<number, PackItem | null> = {};
      const seatIndicesToSpin: number[] = [];
      for (let seatIndex = 0; seatIndex < seatCount; seatIndex += 1) {
        const item = results?.[seatIndex]?.[roundIndex] ?? null;
        roundItemsBySeat[seatIndex] = item;
        const slotIndexOffset = seatIndex * 1000;
        setForcedResult(slotIndexOffset + 0, item);
        if (item) seatIndicesToSpin.push(seatIndex);
      }
      setPendingRoundResults((prev) => ({ ...prev, [roundIndex]: roundItemsBySeat }));

      preloadPackItemImages(Object.values(roundItemsBySeat).filter(Boolean) as PackItem[]);

      // Wait for all players to finish spinning (with a fallback timeout).
      await Promise.race([
        new Promise<void>((resolve) => beginRoundSpin(roundIndex, seatIndicesToSpin, resolve)),
        sleep(roundDelayMs),
      ]);
    }

    setIsPlaybackActive(false);
  };

  const mapRewardToPackItem = (reward: any): PackItem => {
    const valueStr = reward?.value?.toString?.() ?? reward?.template?.value?.toString?.() ?? "0";
    const prob = reward?.metadata?.probability ?? 0;
    const nw = reward?.metadata?.normalizedWeight ?? prob;
    return {
      id: reward?.id ?? "",
      image: reward?.imageUrl ?? reward?.template?.imageUrl ?? "",
      name: reward?.name ?? reward?.template?.name ?? "",
      price: `$${formatCurrency(valueStr)}`,
      probability: "",
      description: reward?.description ?? reward?.template?.description ?? "",
      metadata: { probability: prob, normalizedWeight: nw },
      template: {
        imageUrl: reward?.imageUrl ?? reward?.template?.imageUrl ?? "",
        name: reward?.name ?? reward?.template?.name ?? "",
        value: valueStr,
        description: reward?.description ?? reward?.template?.description ?? "",
      },
    };
  };

  const wsHandlers = useMemo(
    () => ({
      onBattleSnapshot: (data: any) => {
        if (!data?.battleId || data.battleId !== battleStateRef.current.id) return;
        if (!data?.battle) return;
        try {
          const mapped = mapBackendBattleToBattle(data.battle);
          setBattleState(mapped);
        } catch (e) {
          if (process.env.NODE_ENV === "development") console.warn("Failed to apply battle snapshot:", e);
        }
      },
      onBattleParticipantJoined: (data: any) => {
        if (data?.battleId !== battleStateRef.current.id) return;
        getBattleById(battleStateRef.current.id).then((latest) => latest && setBattleState(latest));
      },
      onBattleCountdownStarted: (data: any) => {
        if (data?.battleId !== battleStateRef.current.id) return;
        getBattleById(battleStateRef.current.id).then((latest) => latest && setBattleState(latest));
      },
      onBattleStarted: (data: any) => {
        if (data?.battleId !== battleStateRef.current.id) return;
        getBattleById(battleStateRef.current.id).then((latest) => latest && setBattleState(latest));
      },
      onBattleRoundResolved: (data: any) => {
        if (data?.battleId !== battleStateRef.current.id) return;
        if (!Number.isInteger(data.roundIndex) || data.roundIndex < 0) return;
        if (receivedRoundIndicesRef.current.has(data.roundIndex)) return;

      if (Array.isArray(data.participantTotals) && data.participantTotals.length > 0) {
        setBattleState((prev) => {
          const nextPlayers = prev.players.map((pl) => {
            if (!pl.participantId) return pl;
            const t = data.participantTotals?.find((x: { participantId?: string }) => x.participantId === pl.participantId);
            if (!t) return pl;
            return { ...pl, eliminatedAtRound: t.eliminatedAtRound ?? null };
          });
          return { ...prev, players: nextPlayers };
        });
      }

      // Store each round independently; install its results only when it spins.
      const roundItemsBySeat: Record<number, PackItem | null> = {};
      const players = battleStateRef.current.players;
      const totalsByPid = new Map<string, { eliminatedAtRound?: number | null }>();
      for (const t of (data.participantTotals ?? []) as any[]) {
        if (t?.participantId) totalsByPid.set(String(t.participantId), { eliminatedAtRound: t.eliminatedAtRound ?? null });
      }

      const rollByPid = new Map<string, any>();
      for (const roll of data.rolls || []) {
        if (roll?.participantId) rollByPid.set(String(roll.participantId), roll);
      }

      const seatIndicesToSpin: number[] = [];
      for (let seatIndex = 0; seatIndex < players.length; seatIndex += 1) {
        const pid = players[seatIndex]?.participantId;
        if (!pid) continue;

        const eliminatedAt = totalsByPid.get(pid)?.eliminatedAtRound ?? players[seatIndex]?.eliminatedAtRound ?? null;
        if (battleStateRef.current.mode === "ELIMINATION" && eliminatedAt != null && eliminatedAt <= data.roundIndex) {
          continue;
        }

        const roll = rollByPid.get(pid);
        const item = roll?.packReward ? mapRewardToPackItem(roll.packReward) : null;
        if (!item) continue;
        seatIndicesToSpin.push(seatIndex);
        roundItemsBySeat[seatIndex] = item;
      }
      if (seatIndicesToSpin.length === 0) return;
      receivedRoundIndicesRef.current.add(data.roundIndex);
      pendingRoundResultsRef.current = { ...pendingRoundResultsRef.current, [data.roundIndex]: roundItemsBySeat };
      setPendingRoundResults(pendingRoundResultsRef.current);

      // Preload round result images so slot machine shows them without flicker
      preloadPackItemImages(Object.values(roundItemsBySeat).filter(Boolean) as PackItem[]);

      // If a spin is already in progress (fast battles), queue this round.
      if (activeSpinRef.current) {
        spinQueueRef.current.push({ roundIndex: data.roundIndex, seatIndices: seatIndicesToSpin });
      } else {
        beginRoundSpin(data.roundIndex, seatIndicesToSpin);
      }

      // ELIMINATION tie-break: show wheel (equal odds) using server-provided ticket+ranges.
      const tb = (data as any)?.eliminationTiebreak;
      if (
        tb &&
        tb.type === "participant" &&
        typeof tb.roundIndex === "number" &&
        !eliminationTiebreakShownRef.current.has(tb.roundIndex) &&
        typeof tb.ticket === "number" &&
        Array.isArray(tb.ranges) &&
        tb.ranges.length > 1
      ) {
        eliminationTiebreakShownRef.current.add(tb.roundIndex);
        const ranges = tb.ranges as Array<{ participantId: string; start: number; end: number }>;
        const wheelHueOrder = [0, 180, 60, 240, 120, 300];
        const segments = ranges
          .slice()
          .sort((a, b) => a.start - b.start)
          .map((r, idx) => {
            const seatIndex = battleStateRef.current.players.findIndex((p) => p.participantId === r.participantId);
            const fallbackIndex = seatIndex >= 0 ? seatIndex : idx;
            const label =
              seatIndex >= 0 ? battleStateRef.current.players[seatIndex]?.name || `Seat ${seatIndex + 1}` : "Player";
            const avatar = battleStateRef.current.players[fallbackIndex]?.avatar;
            const hue = wheelHueOrder[idx % wheelHueOrder.length];
            return {
              id: r.participantId,
              label,
              color: `hsl(${hue}, 85%, 55%)`,
              avatar,
              startTicket: r.start,
              endTicket: r.end,
            };
          });

        open("jackpot", {
          segments,
          ticketNumber: tb.ticket,
          winnerId: tb.eliminatedParticipantId ?? null,
          spinDurationMs: 5200,
        });
      }
      },
      onBattleCompleted: (data: any) => {
        if (data?.battleId !== battleStateRef.current.id) return;
        getBattleById(battleStateRef.current.id).then((latest) => latest && setBattleState(latest));
      },
      onBattleSettled: (data: any) => {
        if (data?.battleId !== battleStateRef.current.id) return;
        getBattleById(battleStateRef.current.id).then((latest) => latest && setBattleState(latest));
        const isJackpot = battleStateRef.current.mode === "JACKPOT";
        // Fireworks + sound for non-jackpot battle end. Jackpot: sound plays when the inline server-ticket reveal finishes.
        if (!isJackpot) {
          fireBattleCelebration();
          playBasicWin();
          playSpecialWin();
        }
        // Refresh cart count after payout. For JACKPOT we refresh after the inline ticket reveal finishes.
        if (isAuthenticated && !isJackpot) {
          getCartItems("AVAILABLE").then((cart) => {
            updateUser({ cartCount: cart?.length });
          }).catch(() => {});
        }
      },
    }),
    [isAuthenticated, updateUser, open]
  );
  useWebSocket(wsHandlers);

  // Trigger spin after state updates from round event
  useEffect(() => {
    if (pendingSpinRound == null) return;
    if (!selectedPacks[0]?.items.length) return;

    // The first round can arrive before the in-progress view mounts its reels.
    // Retain the pending spin until every required reel and server result exists.
    let frame: number | null = null;
    let cancelled = false;
    const startWhenReady = () => {
      if (cancelled) return;
      const targets = pendingSpinRound.seatIndices.map((seatIndex) => ({
        seatIndex,
        view: packDrawingViewRefs.current[seatIndex],
        item: pendingRoundResultsRef.current[pendingSpinRound.roundIndex]?.[seatIndex],
      }));
      if (targets.some(({ view, item }) => !view || !item)) {
        frame = window.requestAnimationFrame(startWhenReady);
        return;
      }
      for (const { seatIndex, item } of targets) {
        setForcedResult(seatIndex * 1000, item!);
      }
      for (const { view } of targets) view!.spin();
      setPendingSpinRound(null);
    };
    startWhenReady();
    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSpinRound, selectedPacks, effectiveStatus]);

  const handleJoin = async (seatIndex: number) => {
    if(isCreator&&battleState.sponsorOnly)return;
    if (!isAuthenticated) return;
    if (battleState.status !== "waiting") return;
    if (joiningSeatIndex != null) return;
    if (isPlayerInBattle) return;
    unlockAudio();

    try {
      setJoiningSeatIndex(seatIndex);
      await joinBattle(battleState.id, seatIndex);
      await refreshBattle();
    } catch (e) {
      console.error("Failed to join battle:", e);
      // Best effort: still try to refresh to reflect server state
      await refreshBattle();
    } finally {
      setJoiningSeatIndex(null);
    }
  };

  const handleInviteBot = async (seatIndex: number) => {
    if (!isAuthenticated) return;
    if (!isCreator||battleState.sponsorOnly||Number(battleState.ownerFunding)>0) return;
    if (battleState.status !== "waiting") return;
    if (invitingBotSeatIndex != null) return;

    try {
      setInvitingBotSeatIndex(seatIndex);
      await inviteBot(battleState.id, seatIndex);
      await refreshBattle();
    } catch (e) {
      console.error("Failed to invite bot:", e);
      await refreshBattle();
    } finally {
      setInvitingBotSeatIndex(null);
    }
  };

  // Handle spin complete for a specific player
  const handleSpinComplete = (playerIndex: number) => (results: any[]) => {
    const active = activeSpinRef.current;
    if (!active) return;
    if (!active.seatIndices.includes(playerIndex)) return;
    // Ignore duplicate completion callbacks from the same seat.
    active.seatIndices = active.seatIndices.filter((seat) => seat !== playerIndex);
    const roundIndex = active.roundIndex;

    const item = pendingRoundResultsRef.current?.[roundIndex]?.[playerIndex] ?? null;
    if (item) {
      setOpenedBySeat((prev) => {
        const roundCount = battleState.packs.length || battleState.packCount || 0;
        const existing = prev[playerIndex] ? [...prev[playerIndex]] : Array.from({ length: roundCount }).map(() => null);
        if (roundIndex >= 0 && roundIndex < existing.length) {
          existing[roundIndex] = item;
        }
        return { ...prev, [playerIndex]: existing };
      });
    }

    // Decrement remaining players; when 0, finalize this round and start next queued round (if any).
    active.remaining -= 1;
    if (active.remaining <= 0) {
      setLastRevealedRoundIndex(roundIndex);
      // cleanup pending results for this round to avoid stale memory
      setPendingRoundResults((prev) => {
        const next = { ...prev };
        delete next[roundIndex];
        return next;
      });

      const resolve = active.resolve;
      activeSpinRef.current = null;
      resolve?.();

      const nextRound = spinQueueRef.current.shift();
      if (nextRound) {
        beginRoundSpin(nextRound.roundIndex, nextRound.seatIndices);
      }
    }
  };

  // Initialize refs array based on player count
  if (packDrawingViewRefs.current.length !== battleState.playerCount) {
    packDrawingViewRefs.current = Array(battleState.playerCount).fill(null).map((_, i) => packDrawingViewRefs.current[i] || null);
  }

  // Calculate player distribution based on battle type (use battleState for live updates)
  const { leftSidePlayers, rightSidePlayers, teamPlayers } = useMemo(() => {
    let left: Battle["players"] = [];
    let right: Battle["players"] = [];
    let teams: Battle["players"][] = [];
    const state = battleState;
    if (isTeam && state.teamCount && state.playersPerTeam) {
      for (let i = 0; i < state.teamCount; i++) {
        const startIndex = i * state.playersPerTeam;
        const endIndex = startIndex + state.playersPerTeam;
        teams.push(state.players.slice(startIndex, endIndex));
      }
      if (state.teamCount === 2) {
        left = teams[0] || [];
        right = teams[1] || [];
      }
    } else {
      const playersPerSide = Math.ceil(state.playerCount / 2);
      left = state.players.slice(0, playersPerSide);
      right = state.players.slice(playersPerSide);
    }
    return { leftSidePlayers: left, rightSidePlayers: right, teamPlayers: teams };
  }, [isTeam, battleState.teamCount, battleState.playersPerTeam, battleState.playerCount, battleState.players]);

  // Generate placeholder players for empty slots

  const renderSeatColumn = (playerIndex: number) => {
    const player = battleState.players[playerIndex];
    const isFilled = Boolean(player?.name);
    const teamSize = battleState.playersPerTeam ?? 0;
    const effectiveTeamIndex =
      teamSize > 0 ? Math.floor(playerIndex / teamSize) : null;
    const isWinner =
      effectiveStatus === "completed" && !battleState.cancelledAt &&
      (battleState.mode !== "JACKPOT" || jackpotFinished) &&
      (battleState.battleType === "team"
        ? battleState.winnerTeamIndex != null && effectiveTeamIndex === battleState.winnerTeamIndex
        : battleState.mode === "JACKPOT"
          ? player?.participantId != null && player.participantId === battleState.jackpotWinnerParticipantId
          : player?.participantId != null && player.participantId === battleState.winnerParticipantId);

    const canJoinThisSeat =
      !isFilled && effectiveStatus === "waiting" && isAuthenticated && !isPlayerInBattle && !(isCreator && battleState.sponsorOnly);
    const canInviteBotThisSeat =
      !isFilled && effectiveStatus === "waiting" && isAuthenticated && isCreator && !battleState.sponsorOnly && !Number(battleState.ownerFunding);

    const eliminatedAtRound =
      battleState.mode === "ELIMINATION" && typeof player?.eliminatedAtRound === "number"
        ? player.eliminatedAtRound
        : null;
    const maskRound =
      battleState.status === "completed" && !isPlaybackActive
        ? Number.MAX_SAFE_INTEGER
        : lastRevealedRoundIndex;
    const isEliminated = eliminatedAtRound != null && maskRound >= eliminatedAtRound;

    return (
      <div className="flex flex-col gap-6">
        {isFilled ? (
          <div
            key={battleState.players[playerIndex]?.id}
            className={cn(
              "py-4 px-2 w-full min-h-[100px] bg-gradient-to-b from-[#292a2e] to-[#16171b] border border-white/[0.07] rounded-xl flex flex-wrap gap-2 items-center justify-center shadow-lg",
              isWinner && "border-amber-400/60 shadow-[0_0_24px_rgba(245,197,66,0.12)]"
            )}
          >
            <div className="relative w-12 h-12 shrink-0">
              <Image
                src={getBattlePlayerAvatar(battleState.players[playerIndex])}
                alt={battleState.players[playerIndex]?.name || "Player"}
                className={cn("w-12 h-12 object-contain rounded-full", isEliminated && "opacity-70")}
              />
              {isEliminated ? (
                <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/55 rounded-full">
                  <BannedUserMaskIcon className="w-7 h-7 text-white/80" />
                </div>
              ) : null}
            </div>
            <div className="flex flex-col gap-1 ">
              <p className="max-w-[130px] truncate text-sm font-semibold text-white">{battleState.players[playerIndex]?.name}</p>
              {isWinner && <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-300">Winner</span>}
              {battleState.mode === "JACKPOT" ? (
                <span
                  className="text-xs font-semibold"
                  style={{
                    color:
                      jackpotColorByParticipantId.get(battleState.players[playerIndex]?.participantId ?? "") ??
                      playerColors[playerIndex % playerColors.length],
                  }}
                >
                  {(() => {
                    // Jackpot odds should reflect backend ticket ranges (provably-fair),
                    // including upsideDown logic.
                    const ranges = battleState.jackpotMeta?.ranges;
                    const pid = battleState.players[playerIndex]?.participantId;
                    if (pid && Array.isArray(ranges) && ranges.length > 0) {
                      const r = ranges.find((x) => x.participantId === pid);
                      const count = r ? Math.max(0, r.end - r.start + 1) : 0;
                      const totalTickets = Math.max(1, ...ranges.map((range) => Number(range.end)));
                      const pct = (count / totalTickets) * 100;
                      return formatPercent(pct, 1, false);
                    }
                    // Fallback (pre-completion): show current value share.
                    const pool = getPoolTotal();
                    const seatTotal = getSeatTotal(playerIndex);
                    const pct = pool > 0 ? (seatTotal / pool) * 100 : 0;
                    return formatPercent(pct, 1, false);
                  })()}
                </span>
              ) : (
                <span className="text-xs font-semibold text-white bg-background-sunken rounded-sm py-1 px-2">
                  ${formatCurrency(getSeatTotal(playerIndex))}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div
            key={battleState.players[playerIndex]?.id}
            className=" py-4 w-full h-[100px] bg-[rgba(63,71,84,0.12)] rounded-lg flex gap-2 items-center justify-center"
          >
            <Image
              src={battleState.players[playerIndex]?.avatar || "/assets/avatar/dummy.png"}
              alt={battleState.players[playerIndex]?.name || "Player"}
              className="w-8 h-8 object-contain"
            />
            <div className="flex flex-col gap-2">
              <p>Waiting...</p>
              {canInviteBotThisSeat ? (
                <Button
                  isDisabled={invitingBotSeatIndex === playerIndex}
                  isLoading={invitingBotSeatIndex === playerIndex}
                  onPress={() => handleInviteBot(playerIndex)}
                  className="h-8 min-w-0 px-6 rounded-full bg-[rgba(63,71,84,0.24)] text-white"
                >
                  Invite bot
                </Button>
              ) : canJoinThisSeat ? (
                <Button
                  isDisabled={joiningSeatIndex === playerIndex}
                  isLoading={joiningSeatIndex === playerIndex}
                  onPress={() => handleJoin(playerIndex)}
                  className="h-8 min-w-0 px-6 rounded-full mcPrimary text-white"
                >
                  Join
                </Button>
              ) : null}
            </div>
          </div>
        )}
        <div className={`grid gap-2.5 ${battleState.playerCount > 2 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} `}>
          {battleState.packs.length > 0 &&
            battleState.packs.map((pack, idx) => (
              <div
                key={`${pack.id}-${idx}`}
                className="relative min-w-0"
              >
                <BattleDropCard
                  key={openedBySeat[playerIndex]?.[idx]?.id ?? "pending"}
                  item={openedBySeat[playerIndex]?.[idx]}
                  round={idx + 1}
                  animateReveal={!startedAsCompletedRef.current || isPlaybackActive}
                />

                {isEliminated && eliminatedAtRound != null && idx >= eliminatedAtRound ? (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center z-30">
                    <BannedItemMaskIcon className="w-10 h-10 text-white/80" />
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      </div>
    );
  };


  return (
    <div data-battle-room="v4" className="relative w-full min-h-screen bg-background">
      {/* Back Button */}
      <div className="relative flex flex-col w-full items-center px-3 py-3 gap-6 sm:px-5 sm:gap-16">
        <div className="flex justify-between items-center w-full">
          <Link href="/battles">
            <Button
              className="flex flex-row items-center px-3 py-0.5 gap-1 w-[104px] h-8 bg-[rgba(63,71,84,0.24)] rounded-full"
            >
              <Icon name="arrow-left" className="w-4 h-4" />
              <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                All battles
              </span>
            </Button>
          </Link>

          <Link href="/fairness" aria-label="How battle results are calculated" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white focus-visible:outline-2 focus-visible:outline-violet-300"><Icon name="security-check" className="h-4 w-4" /></Link>
        </div>
        <div className="relative grid w-full grid-cols-2 gap-3 sm:flex sm:flex-row sm:justify-between">
          {/* Jackpot and Total Cost */}
          <div className="flex flex-row items-center gap-0.5 w-[128px] h-[17px]">
            <span className={cn("text-base leading-[17px] tracking-[-0.02em] font-semibold text-center", battleState.mode === "JACKPOT" ? "text-[#eb808b]" : battleState.mode === "ELIMINATION" ? "text-[#FF4545]" : "text-[#eb808b]")}>
              {battleState.mode}
            </span>
            {battleState.upsideDown && <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-crown rotate-180 size-5 text-gray-400" data-state="closed"><path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z"></path><path d="M5 21h14"></path></svg>}
            {battleState.fastBattle && <Icon name="zap" className="w-5 h-5 rotate-180" />}
            {battleState.lastChance && <Icon name="danger" className="w-5 h-5" />}
          </div>

          {/* Pack Display */}
          <div className="order-last col-span-2 flex flex-col items-center gap-2 sm:absolute sm:left-1/2 sm:-translate-x-1/2">

            <div className="flex flex-row items-end h-4">
              <span className="uppercase  leading-[15px] tracking-[-0.02em] font-semibold text-center text-[#6c6c71]">
                {battleState.mode === "JACKPOT" && effectiveStatus === "completed" && !jackpotFinished ? "Drawing jackpot winner…" : effectiveStatus}
              </span>
              {/* <div className="w-px h-4 bg-[rgba(63,71,84,0.24)] rounded-full" /> */}
              {/* <span className="text-sm leading-[15px] tracking-[-0.02em] font-semibold text-center text-white">
              </span> */}
            </div>
          </div>

          <div className="text-right">
            <span className="text-base leading-[17px] tracking-[-0.02em] font-semibold text-center text-white">
              Total Cost: {battle.cost}
            </span>
          </div>


        </div>

        <div className="relative max-w-full p-2 bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-lg sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:top-2">
          {/* Pack images would go here */}
          <div className="flex flex-row items-center gap-2 w-[250px] max-w-full overflow-x-auto scrollbar-hide">
            {battle.packs.map((pack, idx) => (
              <div key={idx} className="w-[42px] h-[64px] relative shrink-0">
                <Image
                  src={pack.image}
                  alt={pack.name}
                  className="w-[42px] h-[64px] object-contain"
                />
              </div>
            ))}
          </div>
        </div>

      </div>


      {battleState.cancelledAt&&<div className="mx-auto my-6 max-w-xl rounded-xl border border-white/10 bg-white/5 p-6 text-center text-white"><h2 className="text-lg font-semibold">Battle cancelled</h2><p className="mt-2 text-sm text-slate-400">The creator’s contribution was refunded. No wager or prize was settled.</p><Link href="/battles" className="mt-4 inline-block text-purple-300">Back to battles</Link></div>}
      {isCreator&&battleState.canCancel&&!battleState.cancelledAt&&<div className="my-3 flex flex-col items-center gap-2"><button type="button" onClick={handleCancel} disabled={cancelling} className="rounded-lg border border-red-300/20 px-4 py-2 text-xs text-red-200 disabled:opacity-40">{cancelling?'Cancelling…':'Cancel battle & refund contribution'}</button>{cancelError&&<p role="alert" className="text-xs text-red-300">{cancelError}</p>}</div>}
      {(battleState.sponsorOnly||Number(battleState.ownerFunding)>0)&&<div className="mx-auto my-4 max-w-4xl rounded-xl border border-purple-300/20 bg-purple-400/5 p-4 text-sm text-purple-100">Sponsored battle · {Number(battleState.sponsorPaid||0).toLocaleString('en-US',{style:'currency',currency:'USD'})} funded. {battleState.fundingCode?`Only players linked to code ${battleState.fundingCode} can join.`:'Open to all eligible players.'} {isCreator?(battleState.sponsorOnly?'This existing battle is sponsor-only. Cancel and recreate it to play as Player 1.':'You are Player 1 and compete for prizes.'):''}</div>}
      {/* Main Battle Arena / Completed Result */}
      <div style={{display:battleState.cancelledAt?"none":undefined}} className="relative w-full bg-[#0f1013] border-t border-b border-[rgba(63,71,84,0.24)]">
        {effectiveStatus === "waiting" && countdownSeconds != null && countdownSeconds > 0 ? (
          <div
            className="max-w-4xl mx-auto w-full flex flex-col items-center justify-center py-20 gap-3 cursor-pointer"
            onClick={unlockAudio}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") unlockAudio(); }}
            role="button"
            tabIndex={0}
            title="Tap to enable sound"
          >
            <div className="text-[#afafb4] text-sm font-semibold">Starting in</div>
            <div className="text-white text-6xl font-extrabold tabular-nums">{countdownSeconds}</div>
          </div>
        ) : effectiveStatus === "waiting" && countdownSeconds === 0 ? (
          <div className="max-w-4xl mx-auto w-full flex flex-col items-center justify-center py-20 gap-3">
            <div className="text-[#afafb4] text-sm font-semibold">Starting...</div>
          </div>
        ) : effectiveStatus === "completed" && battleState.mode === "JACKPOT" && !battleState.cancelledAt && !isPlaybackActive ? (
          <BattleTicketRng
            key={battleState.id + ":" + String(battleState.jackpotMeta?.ticket ?? "pending")}
            segments={jackpotTicketRanges}
            ticket={battleState.jackpotMeta?.ticket}
            winnerId={battleState.jackpotWinnerParticipantId ?? null}
            phase={jackpotFinished ? "complete" : jackpotRevealStarted ? "revealing" : "waiting"}
            fast={!!battleState.fastBattle}
            pot={battleState.jackpotMeta?.pot ?? String(getPoolTotal())}
            onReplay={handlePlayback}
            onFinished={finishJackpotReveal}
            onRefresh={() => void refreshBattle()}
          />
        ) : effectiveStatus === "completed" && !battleState.cancelledAt && !isPlaybackActive ? (
          <BattleResults
            battle={battleState}
            totals={battleState.players.map((_, seat) => getSeatTotal(seat))}
            winnerSeats={Array.from(winnerSeatIndices)}
            ready={allPacksOpened}
            pendingWinner={battleState.mode === "JACKPOT" && !jackpotFinished}
            recreating={isRecreating}
            onReplay={handlePlayback}
            onRecreate={handleRecreateBattle}
            onNewBattle={() => router.push("/create-battle")}
          />
        ) : (
          <div className={` ${battleState.playerCount < 4 ? "max-w-2xl" : "max-w-6xl"} mx-auto w-full grid grid-cols-2 gap-2 sm:gap-4 relative ${battleState.playerCount === 3 ? "lg:grid-cols-3" : battleState.playerCount === 6 ? "lg:grid-cols-6" : battleState.playerCount >= 4 ? "lg:grid-cols-4" : ""}`}>
            {/* Playback controls/overlay */}
            {isPlaybackActive ? (
              <div className="absolute right-4 top-4 z-40 flex items-center gap-2">
                <Button className="h-8 px-4 rounded-md bg-[rgba(63,71,84,0.24)] text-white" onPress={stopPlayback}>
                  Stop replay
                </Button>
              </div>
            ) : null}

            {isPlaybackActive && (playbackCountdownSeconds != null || playbackStatusText) ? (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70">
                {playbackCountdownSeconds != null ? (
                  <>
                    <div className="text-[#afafb4] text-sm font-semibold">Starting in</div>
                    <div className="text-white text-6xl font-extrabold tabular-nums">{playbackCountdownSeconds}</div>
                  </>
                ) : (
                  <div className="text-white text-2xl font-semibold">{playbackStatusText ?? "Starting..."}</div>
                )}
              </div>
            ) : null}

            {/** Only render slot machines when battle is ready (in progress) or replaying */}
            {/** Showing them during waiting causes confusing pre-start visuals */}
            {(effectiveStatus === "in_progress" || isPlaybackActive) ? Array.from({ length: battleState.playerCount }).map((_, playerIndex) => {
              const eliminatedAtRound =
                battleState.mode === "ELIMINATION" && typeof battleState.players[playerIndex]?.eliminatedAtRound === "number"
                  ? battleState.players[playerIndex]?.eliminatedAtRound
                  : null;
              const maskRound =
                battleState.status === "completed" && !isPlaybackActive
                  ? Number.MAX_SAFE_INTEGER
                  : lastRevealedRoundIndex;
              const shouldMaskThisSeat = eliminatedAtRound != null && maskRound >= eliminatedAtRound;

              // Calculate VS indicator positions
              let showVSBefore = false;
              if (isTeam && battleState.teamCount && battleState.playersPerTeam) {
                const isFirstPlayerOfTeam = playerIndex % battleState.playersPerTeam === 0;
                showVSBefore = isFirstPlayerOfTeam && playerIndex > 0;
              } else {
                showVSBefore = playerIndex > 0;
              }

              return (
                <React.Fragment key={playerIndex}>
                  {showVSBefore && (
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-[352px] ${battleState.playerCount > 2 ? "hidden lg:flex" : "flex"} flex-col items-center z-20 pointer-events-none`}
                      style={{ left: `calc(${(playerIndex / battleState.playerCount) * 100}%)` }}
                    >
                      <div className="absolute left-[11px] top-0 w-[1.5px] h-[352px] border-l-2 border-[rgba(63,71,84,0.24)]" />
                      <div className="absolute left-0 top-[164px] w-6 h-6 bg-[#1e1f23] border-4 border-[#0f1013] rounded-full flex items-center justify-center z-10">
                        <span className="text-xs leading-[13px] tracking-[-0.02em] font-semibold text-[#6c6c71]">VS</span>
                      </div>
                    </div>
                  )}

                  <div className="relative flex min-w-0 basis-0 flex-1 flex-col items-center gap-4">
                    <div className="relative grid h-[330px] sm:h-[450px] w-full place-items-center overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-[#1b1c20] via-[#111216] to-[#1b1c20]">

                      <PackDrawingView
                        ref={(el) => {
                          packDrawingViewRefs.current[playerIndex] = el;
                        }}
                        selectedPacks={selectedPacks}
                        onSpinComplete={handleSpinComplete(playerIndex)}
                        fastOpen={!!battleState.fastBattle}
                        sequential={true}
                        forceVertical={true}
                        celebrateDrops={true}
                        slotIndexOffset={playerIndex * 1000}
                      />

                      {shouldMaskThisSeat ? (
                        <div className="absolute inset-0 z-10 bg-black/35 flex items-center justify-center pointer-events-none">
                          <BannedItemMaskIcon className="w-14 h-14 text-white/70" />
                        </div>
                      ) : null}



                    </div>
                  </div>
                </React.Fragment>
              );
            }) :
              <div data-battle-lobby="true" className="relative col-span-full flex min-h-[360px] w-full flex-col items-center justify-center overflow-hidden px-4 py-10 sm:min-h-[450px] sm:px-8">
                <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-8 h-48 w-64 -translate-x-1/2 rounded-full bg-blue-500/[0.07] blur-3xl" />
                <span className="relative flex items-center gap-2 rounded-full border border-blue-300/15 bg-blue-400/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-300 motion-safe:animate-pulse" />
                  {openWaitingSeats > 0 ? "Lobby open" : "Seats filled"}
                </span>
                <h2 className="relative mt-4 text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {openWaitingSeats > 0 ? "Waiting for opponents" : "Preparing your battle"}
                </h2>
                <p className="relative mt-2 max-w-sm text-center text-xs leading-relaxed text-slate-500">
                  {openWaitingSeats > 0
                    ? isCreator ? battleState.sponsorOnly ? "Share this battle with eligible players. You are its sponsor." : (Number(battleState.ownerFunding)>0?"You are Player 1. Share this battle with eligible players to fill the other seats.":"Invite a bot or wait for other players to take a seat.") : "Take an open seat and get ready for the first drop."
                    : "All seats are filled. The first round will begin once the battle is ready."}
                </p>

                <div className="relative mt-6 w-full max-w-md">
                  <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="font-semibold tabular-nums text-slate-300">{filledWaitingSeats} / {waitingCapacity} seats filled</span>
                    <span>{openWaitingSeats > 0 ? `${openWaitingSeats} ${openWaitingSeats === 1 ? "seat" : "seats"} available` : "Getting ready…"}</span>
                  </div>
                  <div data-lobby-progress="true" role="progressbar" aria-label="Filled battle seats" aria-valuemin={0} aria-valuemax={waitingCapacity} aria-valuenow={filledWaitingSeats} className="h-1 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-blue-400 motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${waitingCapacity ? filledWaitingSeats / waitingCapacity * 100 : 0}%` }} />
                  </div>
                </div>

                <div className="relative mt-5 flex w-full max-w-xl flex-wrap justify-center gap-2 sm:gap-3">
                  {battleState.players.map((player, seatIndex) => {
                    const filled = Boolean(player.participantId);
                    return (
                      <div data-filled={filled} data-lobby-seat="true" key={`waiting-${seatIndex}`} className={`flex w-[120px] flex-col items-center rounded-2xl border px-2 py-4 sm:w-[130px] ${filled ? "border-white/[0.08] bg-white/[0.03]" : "border-dashed border-blue-300/15 bg-blue-400/[0.015]"}`}>
                        {filled ? <Image src={getBattlePlayerAvatar(player)} alt={player.name || "Player"} className="h-10 w-10 rounded-full border border-white/10 object-contain" />
                          : <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-blue-300/20 text-xl text-blue-300/40">+</span>}
                        <span className={`mt-2 w-full truncate text-center text-xs font-semibold ${filled ? "text-slate-200" : "text-slate-500"}`}>{filled ? player.name || "Player" : "Open seat"}</span>
                        <span className="mt-1 text-[9px] uppercase tracking-widest text-slate-600">{filled ? player.kind === "BOT" ? "Bot joined" : "Joined" : `Seat ${seatIndex + 1}`}</span>
                        {!filled && isAuthenticated && isCreator && !battleState.sponsorOnly && !Number(battleState.ownerFunding) ? (
                          <Button data-call-bot="true" onPress={() => handleInviteBot(seatIndex)} isLoading={invitingBotSeatIndex === seatIndex} isDisabled={invitingBotSeatIndex != null} className="mt-3 h-7 min-w-0 rounded-lg bg-blue-400/10 px-3 text-[10px] font-semibold text-blue-200">Call bot</Button>
                        ) : !filled && isAuthenticated && !isPlayerInBattle && !(isCreator && battleState.sponsorOnly) ? (
                          <Button onPress={() => handleJoin(seatIndex)} isLoading={joiningSeatIndex === seatIndex} isDisabled={joiningSeatIndex != null} className="mt-3 h-7 min-w-0 rounded-lg mcPrimary px-3 text-[10px] font-semibold text-white">Join seat</Button>
                        ) : !filled && !isAuthenticated ? (
                          <Button onPress={() => open("login")} className="mt-3 h-7 min-w-0 rounded-lg bg-white/[0.04] px-3 text-[10px] text-slate-300">Log in to join</Button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            }
          </div>
        )}
      </div>

      <div className={` ${battleState.playerCount < 4 ? "max-w-2xl" : "max-w-6xl"} mx-auto w-full px-3 py-5 sm:px-5`}>
        {battleState.battleType === "team" && battleState.teamCount && battleState.playersPerTeam ? (
          <div className="grid w-full grid-cols-1 gap-4 lg:flex lg:justify-center">
            {Array.from({ length: battleState.teamCount }).map((_, teamIdx) => {
              const start = teamIdx * battleState.playersPerTeam!;
              const end = start + battleState.playersPerTeam!;
              const teamSeats = Array.from({ length: battleState.playersPerTeam! }).map((__, i) => start + i);

              return (
                <div
                  key={`team-${teamIdx}`}
                  className={cn(
                    "grid gap-2 flex-1 w-full",
                    battleState.playersPerTeam === 3 ? "grid-cols-3" : "grid-cols-2"
                  )}
                >
                  {teamSeats
                    .filter((idx) => idx >= start && idx < end && idx < battleState.playerCount)
                    .map((playerIndex) => (
                      <div key={`seat-${playerIndex}`}>{renderSeatColumn(playerIndex)}</div>
                    ))}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={`grid gap-4 ${battleState.playerCount === 2 ? "grid-cols-2" :
              battleState.playerCount === 3 ? "grid-cols-2 lg:grid-cols-3" :
                battleState.playerCount === 4 ? "grid-cols-2 lg:grid-cols-4" :
                  battleState.playerCount === 6 ? "grid-cols-2 lg:grid-cols-6" :
                    "grid-cols-1"
              }`}
          >
            {Array.from({ length: battleState.playerCount }).map((_, playerIndex) => (
              <div key={playerIndex}>{renderSeatColumn(playerIndex)}</div>
            ))}
          </div>
        )}
      </div>

      {effectiveStatus === "completed" && battleState.mode === "JACKPOT" && jackpotFinished && !battleState.cancelledAt && !isPlaybackActive && (
        <BattleResults
          battle={battleState}
          totals={battleState.players.map((_, seat) => getSeatTotal(seat))}
          winnerSeats={Array.from(winnerSeatIndices)}
          ready={allPacksOpened}
          pendingWinner={false}
          recreating={isRecreating}
          onReplay={handlePlayback}
          onRecreate={handleRecreateBattle}
          onNewBattle={() => router.push("/create-battle")}
        />
      )}


      {/* {battleState.status === "completed" && battleState.mode !== "SHARED" ? (
        <div className="max-w-4xl mx-auto w-full pb-8 px-5">
          <div className="w-full bg-[rgba(63,71,84,0.12)] border border-[rgba(63,71,84,0.24)] rounded-lg p-4 text-white">
            <div className="text-sm font-semibold">Battle Completed</div>
            <div className="text-xs text-[#afafb4] mt-1">
              {battleState.battleType === "team"
                ? `Winning team: ${battleState.winnerTeamIndex ?? "-"}`
                : battleState.mode === "JACKPOT"
                  ? "Jackpot winner selected"
                  : "Winner selected"}
            </div>

            <div className="mt-4 grid gap-2">
              {battleState.players.map((p, idx) => (
                <div
                  key={`${p.id}-${idx}`}
                  className="flex items-center justify-between text-sm bg-[rgba(63,71,84,0.12)] rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Image src={p.avatar} alt={p.name || "Player"} className="w-6 h-6 object-contain" />
                    <span className="font-medium">{p.name || `Seat ${idx + 1}`}</span>
                  </div>
                  <div className="font-semibold">${formatCurrency(getSeatTotal(idx))}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null} */}

    </div>
  );
}
