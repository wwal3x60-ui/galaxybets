"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Image } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PackSelectorModal from "@/components/packs/PackSelectorModal";
import { createBattle, type CreateBattleRequest } from "@/lib/api/battles";
import type { PackDetails } from "@/lib/api/packs";
import { getWalletBalance } from "@/lib/api/wallet";
import { formatCurrency } from "@/lib/utils/numbers";
import { addToast } from "@/lib/toast";
import { useAuthStore } from "@/store/auth.store";
import { useModalStore } from "@/store/modal.store";
import { BattleBuildSteps, BattleSeats } from "@/components/games/SurfaceDetails";

type Format = "2" | "3" | "4" | "2v2" | "2v2v2";
const MAX_PACKS = 20;
const SOLO: Format[] = ["2", "3", "4"];
const TEAM: Format[] = ["2v2", "2v2v2"];
const panel = "rounded-2xl border border-white/[0.07] bg-[#1e1f23] p-4 sm:p-6";
const smallButton = "rounded-md bg-white/[0.04] py-1.5 text-xs text-slate-300 outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-20";

export function packPrice(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}
export function buildClassicBattle(format: Format, packs: PackDetails[]): CreateBattleRequest {
  const team = format.includes("v");
  const teamCount = team ? format.split("v").length : null;
  return { type: team ? "TEAM" : "SOLO", mode: "CLASSIC", maxPlayers: team ? Number(teamCount) * 2 : Number(format), teamSize: team ? 2 : null, teamCount, fastBattle: false, lastChance: false, upsideDown: false, rounds: packs.map((pack) => ({ packId: pack.id, opensPerParticipant: 1 })) };
}

export function CreateBattlePage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const { open } = useModalStore();
  const [funding,setFunding]=useState(0);
  const [affiliateCode,setAffiliateCode]=useState("");
  const [mode,setMode]=useState<"CLASSIC"|"JACKPOT">("CLASSIC");
  const [fastBattle,setFastBattle]=useState(false);
  const [format, setFormat] = useState<Format>("2");
  const [selectedPacks, setSelectedPacks] = useState<PackDetails[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const submitLock = useRef(false);
  const team = TEAM.includes(format);
  const total = useMemo(() => Math.round(selectedPacks.reduce((sum, pack) => sum + packPrice(pack.price), 0) * 100) / 100, [selectedPacks]);
  const request={...buildClassicBattle(format,selectedPacks),mode,fastBattle,fundingPercentage:funding,affiliateCode:funding>0?affiliateCode.trim():undefined};
  const perSeatFund=Math.round(Math.round(total*100)*funding/100)/100;
  const charge=funding>0?Math.round((total+perSeatFund*(request.maxPlayers-1))*100)/100:total;
  const entry=total-perSeatFund;

  useEffect(() => { if (hasHydrated && !isAuthenticated) router.replace("/battles"); }, [hasHydrated, isAuthenticated, router]);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("recreateBattleConfig");
      if (!stored) return;
      const config = JSON.parse(stored);
      if(config?.gameMode==="jackpot"||config?.mode==="JACKPOT")setMode("JACKPOT");
      setFastBattle(config?.fastBattle===true);
      if ([...SOLO, ...TEAM].includes(config?.playerCount)) setFormat(config.playerCount);
      else setFormat(config?.battleType === "team" ? "2v2" : "2");
      if (Array.isArray(config?.packs)) setSelectedPacks(config.packs.filter((pack: PackDetails) => pack && pack.id != null).slice(0, MAX_PACKS));
    } catch { console.warn("Could not restore the previous battle selection."); }
    finally { localStorage.removeItem("recreateBattleConfig"); }
  }, []);

  const moveRound = (index: number, direction: number) => {
    if (creating) return;
    setSelectedPacks((previous) => {
      const target = index + direction;
      if (target < 0 || target >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const duplicateRound = (index: number) => {
    if (creating) return;
    setSelectedPacks((previous) => previous.length >= MAX_PACKS ? previous : [...previous.slice(0, index + 1), previous[index], ...previous.slice(index + 1)]);
  };
  const handleCreateBattle = async () => {
    if (submitLock.current) return;
    if (!isAuthenticated) { open("login"); return; }
    if (!selectedPacks.length) { addToast({ title: "Select at least one case", color: "danger" }); return; }
    if (selectedPacks.length > MAX_PACKS) return;
    if(charge>10000||entry>10000){addToast({title:"$10,000 maximum",description:"Your contribution and each player’s entry must each be $10,000 or less.",color:"danger"});return;}
    // Lock before the balance request to prevent double-click submissions.
    submitLock.current = true;
    setCreating(true);
    let navigating = false;
    try {
      const { balance } = await getWalletBalance();
      const available = Number(balance);
      if (!Number.isFinite(available)) throw new Error("Could not verify your balance. Please try again.");
      if (available < charge) {
        addToast({ title: "Insufficient balance", description: `Your contribution costs $${formatCurrency(charge)}. Your balance is $${formatCurrency(available)}.`, color: "danger" });
        return;
      }
      const created = await createBattle(request);
      router.push(`/battles/${created.id}`);
      navigating = true;
    } catch (error: unknown) {
      addToast({ title: "Could not create battle", description: error instanceof Error ? error.message : "Please try again.", color: "danger" });
    } finally {
      if (!navigating) { submitLock.current = false; setCreating(false); }
    }
  };

  return (
    <div data-battle-builder="v3" className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-5 sm:py-10">
      <Link href="/battles" className="text-xs text-slate-500 hover:text-slate-200">← All battles</Link>
      <header data-builder-header="true" className="mb-7 mt-4"><h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Build your battle</h1><p className="mt-2 text-xs text-slate-500">Choose your format, line up the cases, and get ready for the first drop.</p><BattleBuildSteps count={selectedPacks.length}/></header>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
<section data-battle-section="packs" className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-sm font-semibold text-white"><span className="mr-3 text-blue-300/60">03</span>Line up your cases <span className="ml-1 text-xs font-normal text-slate-500">{selectedPacks.length}/{MAX_PACKS}</span></h2>{selectedPacks.length > 0 && <button type="button" disabled={creating} onClick={() => setSelectedPacks([])} className="text-[10px] text-slate-500 hover:text-red-300">Clear selection</button>}</div>
            <p className="mt-2 text-[10px] text-slate-500">Each case is one round. Use the arrows to change the order.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {selectedPacks.map((pack, index) => <div key={`${pack.id}-${index}`} className="relative min-w-0 rounded-xl border border-white/[0.06] bg-black/15 p-3">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Round {index + 1}</span>
                <Image src={pack.image} alt={pack.name} className="mx-auto h-28 w-full object-contain" />
                <p title={pack.name} className="mt-1 truncate text-xs font-semibold text-slate-200">{pack.name}</p><p className="mt-1 text-sm font-bold tabular-nums text-white">${formatCurrency(packPrice(pack.price))}</p>
                <div className="mt-3 grid grid-cols-4 gap-1">
                  <button type="button" title="Move earlier" aria-label={`Move round ${index + 1} earlier`} disabled={creating || index === 0} onClick={() => moveRound(index, -1)} className={smallButton}>←</button>
                  <button type="button" title="Move later" aria-label={`Move round ${index + 1} later`} disabled={creating || index === selectedPacks.length - 1} onClick={() => moveRound(index, 1)} className={smallButton}>→</button>
                  <button type="button" title="Add another of this case" aria-label={`Duplicate round ${index + 1}`} disabled={creating || selectedPacks.length >= MAX_PACKS} onClick={() => duplicateRound(index)} className={smallButton}>+</button>
                  <button type="button" title="Remove case" aria-label={`Remove round ${index + 1}`} disabled={creating} onClick={() => setSelectedPacks((previous) => previous.filter((_, position) => position !== index))} className={smallButton}>×</button>
                </div>
              </div>)}
              <button type="button" disabled={creating || selectedPacks.length >= MAX_PACKS} onClick={() => setSelectorOpen(true)} className="flex min-h-[210px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-blue-300/20 bg-blue-400/[0.025] px-3 text-blue-200 outline-none hover:bg-blue-400/[0.06] focus-visible:ring-2 focus-visible:ring-blue-300 disabled:opacity-30"><span className="text-3xl font-light">+</span><span className="text-xs font-semibold">Add cases</span><span className="text-[9px] text-slate-500">Choose your next drop</span></button>
            </div>
          </section>
<div data-battle-options="true"><section data-battle-section="format" className={panel}>
            <h2 className="text-sm font-semibold text-white"><span className="mr-3 text-blue-300/60">01</span>Choose the format</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {([false, true] as const).map((isTeam) => <button key={String(isTeam)} type="button" disabled={creating} aria-pressed={team === isTeam} onClick={() => setFormat(isTeam ? "2v2" : "2")} className={`rounded-xl border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${team === isTeam ? "border-blue-400/40 bg-blue-400/[0.07]" : "border-white/[0.06] bg-white/[0.02]"}`}><span className="block text-sm font-semibold text-white">{isTeam ? "Team battle" : "Solo battle"}</span><span className="mt-1 block text-[10px] leading-relaxed text-slate-500">{isTeam ? "Compete together as a team" : "Every player for themselves"}</span></button>)}
            </div>
            <p className="mb-2 mt-5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{team ? "Team setup" : "Number of players"}</p>
            <div className="flex flex-wrap gap-2">{(team ? TEAM : SOLO).map((value) => <button type="button" key={value} disabled={creating} aria-pressed={format === value} onClick={() => setFormat(value)} className={`min-w-[60px] rounded-xl border px-4 py-3 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${format === value ? "border-blue-400/40 bg-blue-400/10 text-blue-200" : "border-white/[0.07] text-slate-400 hover:text-white"}`}>{value.includes("v") ? value.replaceAll("v", " vs ") : value}</button>)}</div>
          </section>
<section data-battle-section="mode" className={panel}>
            <h2 className="text-sm font-semibold text-white"><span className="mr-3 text-blue-300/60">02</span>Game mode</h2>
            <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([['CLASSIC','Classic','Highest total wins.'],['JACKPOT','Jackpot','Each dollar of drops earns a ticket. The winning team shares the pot.']] as const).map(([value,title,description])=><button type="button" key={value} disabled={creating} aria-pressed={mode===value} onClick={()=>setMode(value)} className={`rounded-xl border p-4 text-left ${mode===value?'border-blue-400/40 bg-blue-400/[0.07] text-blue-200':'border-white/10 text-slate-400'}`}><span className="text-sm font-semibold">{title}</span><p className="mt-2 text-[10px] leading-relaxed text-slate-400">{description}</p></button>)}
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-4 text-sm text-slate-300"><input type="checkbox" checked={fastBattle} disabled={creating} onChange={e=>setFastBattle(e.target.checked)}/> Fast battle</label>
            </div>
          </section></div>
<section data-battle-section="funding" className={panel}><h2 className="text-sm font-semibold text-white">Fund the other seats</h2><p className="mt-2 text-xs text-slate-400">You play as Player 1 and can win. Pay for your own seat and optionally fund up to 100% of the other seats.</p><label className="mt-4 flex items-center gap-3 text-sm text-white"><input type="checkbox" checked={funding>0} disabled={creating} onChange={e=>setFunding(e.target.checked?100:0)}/> Enable funding</label>{funding>0&&<div className="mt-4 space-y-4"><div role="group" aria-label="Funding presets" className="grid grid-cols-3 gap-2 sm:grid-cols-6">{[50,60,70,75,80,90].map(percent=><button key={percent} type="button" aria-pressed={funding===percent} disabled={creating} onClick={()=>setFunding(percent)} className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:opacity-50 ${funding===percent?'border-purple-400 bg-purple-500/25 text-purple-100':'border-white/10 bg-black/20 text-slate-300 hover:border-purple-400/50'}`}>{percent}%</button>)}</div><label className="block text-xs text-slate-300">Funded: {funding}%<input aria-label="Funding percentage" className="mt-3 block w-full" type="range" min="1" max="100" value={funding} disabled={creating} onChange={e=>setFunding(Number(e.target.value))}/></label><label className="block text-xs text-slate-300">Restrict to an affiliate code (optional)<input className="mt-2 block w-full rounded-lg border border-white/10 bg-black/20 p-3 text-white" placeholder="Leave blank for all players" value={affiliateCode} maxLength={32} disabled={creating} onChange={e=>setAffiliateCode(e.target.value)}/></label><p className="text-xs text-slate-400">Your total: ${formatCurrency(charge)} (your seat + funding) · Other players pay: ${formatCurrency(entry)} each. Affiliate-code restrictions apply to the other players. Admins can use any valid code.</p></div>}</section>
</div>
        <aside data-battle-summary="true" className="rounded-2xl border border-blue-300/15 bg-gradient-to-b from-[#2e2f33] to-[#1b1c20] p-5 lg:sticky lg:top-5">
          <h2 className="text-sm font-semibold text-white">Your battle</h2><BattleSeats players={request.maxPlayers} team={team} funding={funding}/>
          <div className="mt-5 space-y-3 text-xs"><div className="flex justify-between"><span className="text-slate-500">Format</span><span className="font-semibold text-slate-200">{team ? format.replaceAll("v", " vs ") : `${format} players`}</span></div><div className="flex justify-between"><span className="text-slate-500">Mode</span><span className="text-blue-200">{mode==="JACKPOT"?"Jackpot":"Classic"}{fastBattle?" · Fast":""}</span></div><div className="flex justify-between"><span className="text-slate-500">Rounds</span><span className="tabular-nums text-slate-200">{selectedPacks.length}</span></div><div className="flex justify-between"><span className="text-slate-500">Total seats</span><span className="text-slate-200">{request.maxPlayers}</span></div></div>
          <div className="mt-5 border-t border-white/[0.07] pt-5"><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{funding>0?"Your seat + funding":"Your entry cost"}</p><p className="mt-2 text-3xl font-bold tabular-nums text-white">${formatCurrency(charge)}</p><p className="mt-2 text-[10px] leading-relaxed text-slate-500">{funding>0?"You occupy Player 1 and compete for prizes. The total includes your full seat price plus funding for the other seats.":"The selected case prices make up your entry. Each player pays their own entry."}</p></div>
          <Button onPress={handleCreateBattle} isLoading={creating} isDisabled={!selectedPacks.length || creating || !hasHydrated} className="mt-5 h-12 w-full rounded-xl mcPrimary font-semibold text-white">{creating ? "Creating battle…" : "Create battle"}</Button>
          {!selectedPacks.length && <p className="mt-3 text-center text-[10px] text-slate-500">Add a case to get started.</p>}
          <p role="status" className="mt-3 text-center text-[10px] text-slate-500">{creating ? "Checking your balance and opening the lobby…" : `Up to ${MAX_PACKS} rounds per battle`}</p>
        </aside>
      </div>
      <PackSelectorModal isOpen={selectorOpen} onClose={() => setSelectorOpen(false)} selectedPacks={selectedPacks} updateSelectedPacks={(packs) => { if (!submitLock.current) setSelectedPacks(packs.slice(0, MAX_PACKS)); }} maxPacks={MAX_PACKS} />
    </div>
  );
}
