"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { mapBackendBattleToBattle, type Battle } from "@/lib/api/battles";
import type { OldBattle } from "@/lib/api/battle-protocol";
import { websocketManager } from "@/lib/websocket";
import { useAuthStore } from "@/store/auth.store";
import { useModalStore } from "@/store/modal.store";
import BattleCard from "./BattleCard";

type StatusFilter = "all" | Battle["status"];
export function filterLobbyBattles(battles: Battle[], status: StatusFilter, sort: string): Battle[] {
  const money = (value: string) => Number(value.replace(/[^0-9.-]/g, "")) || 0;
  return battles.filter((battle) => status === "all" || battle.status === status).sort((a, b) => {
    const tie = (Number(b.id) || 0) - (Number(a.id) || 0);
    if (sort === "price-low") return money(a.cost) - money(b.cost) || tie;
    if (sort === "price-high") return money(b.cost) - money(a.cost) || tie;
    const age = (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || tie;
    return sort === "oldest" ? -age : age;
  });
}

export default function BattlesPage() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState("newest");
  const [refresh, setRefresh] = useState(0);
  const { isAuthenticated } = useAuthStore();
  const { open } = useModalStore();
  const router = useRouter();

  useEffect(() => {
    const raw = new Map<string, OldBattle>();
    let alive = true;
    let detach = () => {};
    let attached: ReturnType<typeof websocketManager.getSocket> = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let wasConnected = false;
    const clearWait = () => { if (timeout) clearTimeout(timeout); };
    const publish = () => {
      if (!alive) return;
      const mapped: Battle[] = [];
      for (const battle of raw.values()) {
        try { mapped.push(mapBackendBattleToBattle(battle)); } catch (error) { console.warn("Could not read lobby battle:", error); }
      }
      // Keep every active battle plus the most recent 100 completed entries.
      const completed = mapped.filter((battle) => battle.status === "completed").sort((a, b) => Number(b.id) - Number(a.id));
      const keep = new Set(completed.slice(0, 100).map((battle) => battle.id));
      for (const battle of completed.slice(100)) raw.delete(battle.id);
      setBattles(mapped.filter((battle) => battle.status !== "completed" || keep.has(battle.id)));
    };
    const request = () => {
      if (!attached?.connected) return;
      clearWait(); setRefreshing(true);
      timeout = setTimeout(() => {
        if (alive) { setError("The lobby is taking too long to respond. Try Refresh."); setLoading(false); setRefreshing(false); }
      }, 8000);
      attached.emit("battles:subscribe");
    };
    const unsubscribe = websocketManager.subscribeStatus((snapshot) => {
      if (!alive) return;
      setConnected(snapshot.connected);
      if (!snapshot.connected) { wasConnected = false; return; }
      const socket = websocketManager.getSocket();
      if (!socket) return;
      if (attached !== socket) {
        detach(); attached = socket;
        const push = (list: OldBattle[]) => {
          if (!Array.isArray(list) || !alive) return;
          for (const battle of list) if (battle?.id != null) raw.set(String(battle.id), battle);
          clearWait(); setError(null); setLoading(false); setRefreshing(false); publish();
        };
        const join = (id: string | number, player: OldBattle["players"][number]) => {
          const battle = raw.get(String(id)); if (!battle || !player) return;
          raw.set(String(id), { ...battle, players: [...battle.players.filter((p) => Number(p.slot) !== Number(player.slot)), player] }); publish();
        };
        const round = (id: string | number, value: number) => {
          const battle = raw.get(String(id)); if (!battle) return;
          raw.set(String(id), { ...battle, round: Number(value), startedAt: battle.startedAt || new Date().toISOString() }); publish();
        };
        const ended = (id: string | number, winnerTeam: number) => {
          const battle = raw.get(String(id)); if (!battle) return;
          raw.set(String(id), { ...battle, winnerTeam, endedAt: new Date().toISOString() }); publish();
        };
        socket.on("battles:push", push); socket.on("battles:join", join); socket.on("battles:round", round); socket.on("battles:ended", ended);
        detach = () => { socket.off("battles:push", push); socket.off("battles:join", join); socket.off("battles:round", round); socket.off("battles:ended", ended); };
      }
      if (!wasConnected) { wasConnected = true; request(); }
    });
    websocketManager.connect(useAuthStore.getState().token ?? undefined);
    // Reconcile missed broadcasts after focus, reconnect, or a quiet interval.
    const focus = () => { if (document.visibilityState === "visible") request(); };
    document.addEventListener("visibilitychange", focus);
    const interval = setInterval(() => { if (document.visibilityState === "visible") request(); }, 30000);
    if (!wasConnected) timeout = setTimeout(() => { if (alive) { setLoading(false); setRefreshing(false); setError("Cannot connect to the battle lobby. Check that the backend is running."); } }, 8000);
    return () => { alive = false; clearWait(); clearInterval(interval); unsubscribe(); detach(); document.removeEventListener("visibilitychange", focus); };
  }, [refresh]);

  const visible = useMemo(() => filterLobbyBattles(battles, status, sort), [battles, status, sort]);
  const tabs: Array<{ id: StatusFilter; label: string }> = [{ id: "all", label: "All" }, { id: "waiting", label: "Waiting" }, { id: "in_progress", label: "Live" }, { id: "completed", label: "Completed" }];

  return (
    <div className="crPage crBattleLobby">
      <div className="crPageTitle">
        <div><span className="crEyebrow">THE ARENA</span><h1>Case battles</h1><p>Find an open seat or follow a live battle.</p></div>
        <button type="button" onClick={() => isAuthenticated ? router.push("/create-battle") : open("login")} className="crButton crButtonPrimary">Create battle</button>
      </div>
      <div className="crBattleLobbyBanner"><div><h2>Pick your cases.<br/><em>Build your battle.</em></h2><p>Classic, team, shared, and jackpot formats.</p></div><Image src="/assets/crimson/cases/redline.webp" alt="" width={640} height={512}/><Image src="/assets/crimson/cases/carbon.webp" alt="" width={640} height={512}/></div>
      <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" aria-label="Battle status filters">
          {tabs.map((tab) => <button type="button" key={tab.id} aria-pressed={status === tab.id} onClick={() => setStatus(tab.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-purple-300 ${status === tab.id ? "bg-purple-400/15 text-purple-200" : "text-slate-500 hover:text-slate-200"}`}>{tab.label} <span className="ml-1 text-[10px] opacity-60">{tab.id === "all" ? battles.length : battles.filter((battle) => battle.status === tab.id).length}</span></button>)}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">Sort by
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#18191d] px-3 py-2 text-xs text-slate-200 outline-none focus-visible:ring-2 focus-visible:ring-purple-300">
            <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option>
          </select>
        </label>
      </div>
      <div className="my-4 flex items-center justify-between gap-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />{connected ? "Live updates connected" : "Connecting to lobby…"}</span>
        <button type="button" onClick={() => { setError(null); setRefreshing(true); setRefresh((value) => value + 1); }} className="rounded-md px-2 py-1 text-slate-400 hover:text-white">{refreshing ? "Refreshing…" : "Refresh"}</button>
      </div>
      {error && <p role="status" className="mb-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs text-amber-200">{error}</p>}
      <div className="flex flex-col gap-3" aria-busy={loading}>
        {loading ? Array.from({ length: 3 }, (_, index) => <div key={index} className="h-44 rounded-2xl border border-white/[0.06] bg-white/[0.025] motion-safe:animate-pulse" aria-label="Loading battle" />)
          : visible.length ? visible.map((battle) => <BattleCard key={battle.id} battle={battle} />)
          : <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center"><p className="font-semibold text-slate-300">{error ? "Lobby unavailable" : "No battles in this view"}</p><p className="mt-2 text-xs text-slate-500">{error ? "Use Refresh to try again." : status === "completed" ? "Recent results will appear here as battles finish." : "Try another filter or create a battle."}</p></div>}
      </div>
    </div>
  );
}
