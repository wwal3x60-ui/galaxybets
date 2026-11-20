"use client";

import { useState, useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import Link from "next/link";
import { Button } from "@heroui/react";
import { addToast } from "@/lib/toast";
import PackDrawingView, { PackDrawingViewHandle } from "./PackDrawingView";
import PackDetails from "./PackDetails";
import PackSlots from "./PackSlots";
import PackItemCard from "../ui/PackItem";
import PackSelectorModal from "./PackSelectorModal";
import { useAuthStore } from "@/store/auth.store";
import { useSpinStore } from "@/store/spin.store";
import { getWalletBalance } from "@/lib/api/wallet";
import { getCartItems } from "@/lib/api/cart";
import { getCurrentUser } from "@/lib/api/users";



interface PackDrawingPageProps {
  initialPack?: APIPackDetails;
  packId: string;
}

import {
  drawerCancel,
  drawerInit,
  drawerOpen,
  drawerSync,
  type DrawerOpenResult,
  getPacks,
  getPackDetails,
  type Pack as APIPack,
  type PackItem as APIPackItem,
  type PackDetails as APIPackDetails,
} from "@/lib/api/packs";
import { PackOpeningTitle } from "@/components/games/SurfaceDetails";

export default function PackDrawingPage({
  initialPack,
  packId
}: PackDrawingPageProps) {
  const [pack, setPack] = useState<APIPackDetails | null>(initialPack || null);
  const [allPacks, setAllPacks] = useState<Array<{ id: string; name: string; price: string; image: string }>>([]);
  const [selectedPacks, setSelectedPacks] = useState<APIPackDetails[]>(initialPack ? [initialPack] : []);
  const [quantity, setQuantity] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(!initialPack);
  const [isOpening, setIsOpening] = useState(false);
  const packDrawingViewRef = useRef<PackDrawingViewHandle>(null);

  // Drawer session state
  const [drawerSessionId, setDrawerSessionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`
  );
  const [drawerReady, setDrawerReady] = useState(false);
  const [slotSeedHashes, setSlotSeedHashes] = useState<Record<number, string>>({});
  const [slotPackInstanceIds, setSlotPackInstanceIds] = useState<Record<number, string>>({});
  const [pendingSpin, setPendingSpin] = useState(false);
  const [lastOpenResults, setLastOpenResults] = useState<DrawerOpenResult[] | null>(null);
  const [resetDrawerAfterSpin, setResetDrawerAfterSpin] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [pendingOpenToast, setPendingOpenToast] = useState<{
    title: string;
    description: string;
    color?: "success" | "danger" | "warning" | "default";
  } | null>(null);
  const [openLoopRemaining, setOpenLoopRemaining] = useState(0);
  const [openLoopTotal, setOpenLoopTotal] = useState(0);
  const [fastOpen,setFastOpen]=useState(false);
  const spinCompleteResolveRef = useRef<(() => void) | null>(null);
  const isOpeningLoopRef = useRef(false);
  const initInFlightRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const token = useAuthStore((s) => s.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const { setForcedResults, clearAllResults } = useSpinStore();

  // Track latest session for unmount-only cancel (avoid cancelling when swapping sessions)
  const drawerSessionIdRef = useRef(drawerSessionId);
  const drawerReadyRef = useRef(drawerReady);
  useEffect(() => {
    drawerSessionIdRef.current = drawerSessionId;
    drawerReadyRef.current = drawerReady;
  }, [drawerSessionId, drawerReady]);

  const nextDrawerSessionRef = useRef<{
    drawerSessionId: string;
    instances: Array<{ slotIndex: number; packInstanceId: string; serverSeedHash: string; pack: APIPackDetails }>;
  } | null>(null);

  const createNewDrawerSessionId = () =>
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`;

  /** Pack IDs for one round (selected slots, max 6). Quantity = how many times we open this set. */
  const getDrawerPackIds = () => selectedPacks.map((p) => p.id);

  const startPrefetchNextDrawerSession = async () => {
    try {
      if (!token) return;
      const nextId = createNewDrawerSessionId();
      const packIds = getDrawerPackIds();
      const init = await drawerInit(nextId, packIds);
      const ordered = [...init.instances].sort((a, b) => a.slotIndex - b.slotIndex);
      nextDrawerSessionRef.current = {
        drawerSessionId: init.drawerSessionId,
        instances: ordered.map((x) => ({
          slotIndex: x.slotIndex,
          packInstanceId: x.packInstanceId,
          serverSeedHash: x.serverSeedHash,
          pack: x.pack,
        })),
      };
    } catch (e) {
      console.error("Prefetch next drawer session failed:", e);
      nextDrawerSessionRef.current = null;
    }
  };

  const applyNextDrawerSessionIfReady = () => {
    const next = nextDrawerSessionRef.current;
    if (!next) return false;

    setDrawerSessionId(next.drawerSessionId);
    setSelectedPacks(next.instances.map((x) => x.pack));

    const seedMap: Record<number, string> = {};
    const instanceMap: Record<number, string> = {};
    for (const inst of next.instances) {
      seedMap[inst.slotIndex] = inst.serverSeedHash;
      instanceMap[inst.slotIndex] = inst.packInstanceId;
    }
    setSlotSeedHashes(seedMap);
    setSlotPackInstanceIds(instanceMap);

    clearAllResults();
    setLastOpenResults(null);
    setResetDrawerAfterSpin(false);
    nextDrawerSessionRef.current = null;
    setDrawerReady(true);
    return true;
  };

  // Fetch pack details if not provided
  useEffect(() => {
    if (!initialPack && packId) {
      setIsPageLoading(true);
      getPackDetails(packId)
        .then((packDetails) => {
          setPack(packDetails);
          setSelectedPacks([packDetails]);
        })
        .catch((error) => {
          console.error("Error fetching case details:", error);
        })
        .finally(() => {
          setIsPageLoading(false);
        });
    }
  }, [packId, initialPack]);

  // Fetch all packs for modal on mount
  useEffect(() => {
    getPacks()
      .then((response) => {
        setAllPacks(response.packs.map((pack) => ({
          id: pack.id,
          name: pack.name,
          price: pack.price,
          image: pack.image,
        })));
      })
      .catch((error) => {
        console.error("Error fetching cases:", error);
      });
  }, []);

  const selectedPackIdsKey = selectedPacks.map((p) => p.id).join("|");

  // Drawer init (one call: create draft instances + seed hashes + pack info for selected slots, max 6)
  useEffect(() => {
    if (drawerReady) return;
    if (selectedPacks.length === 0) return;
    if (initInFlightRef.current) return;
    if (isOpeningLoopRef.current) return;
    if (!token) return;

    (async () => {
      try {
        initInFlightRef.current = true;
        const packIds = getDrawerPackIds();
        const init = await drawerInit(drawerSessionId, packIds);

        const ordered = [...init.instances].sort((a, b) => a.slotIndex - b.slotIndex);
        setSelectedPacks(ordered.map((x) => x.pack));

        const seedMap: Record<number, string> = {};
        const instanceMap: Record<number, string> = {};
        for (const inst of ordered) {
          seedMap[inst.slotIndex] = inst.serverSeedHash;
          instanceMap[inst.slotIndex] = inst.packInstanceId;
        }
        setSlotSeedHashes(seedMap);
        setSlotPackInstanceIds(instanceMap);
        setDrawerReady(true);
      } catch (e) {
        console.error("Drawer init failed:", e);
      } finally {
        initInFlightRef.current = false;
      }
    })();
  }, [drawerReady, drawerSessionId, selectedPackIdsKey, selectedPacks, token]);

  // Drawer sync whenever selected pack IDs change (avoid partial opens)
  useEffect(() => {
    if (!drawerReady) return;
    if (selectedPacks.length === 0) return;
    if (syncInFlightRef.current) return;
    if (isOpeningLoopRef.current) return;
    if (!token) return;

    (async () => {
      try {
        syncInFlightRef.current = true;
        const sync = await drawerSync(drawerSessionId, getDrawerPackIds());
        const ordered = [...sync.instances].sort((a, b) => a.slotIndex - b.slotIndex);

        const seedMap: Record<number, string> = {};
        const instanceMap: Record<number, string> = {};
        for (const inst of ordered) {
          seedMap[inst.slotIndex] = inst.serverSeedHash;
          instanceMap[inst.slotIndex] = inst.packInstanceId;
        }
        setSlotSeedHashes(seedMap);
        setSlotPackInstanceIds(instanceMap);
      } catch (e) {
        console.error("Drawer sync failed:", e);
      } finally {
        syncInFlightRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerReady, drawerSessionId, selectedPackIdsKey, token]);

  // Cancel on page leave (best effort)
  useEffect(() => {
    return () => {
      // IMPORTANT: only run on actual component unmount, not on session swap
      if (!drawerReadyRef.current) return;
      drawerCancel(drawerSessionIdRef.current).catch(() => {
        // ignore best-effort cleanup
      });
    };
  }, []);

  // Trigger spin after forced results are set (using store)
  const forcedResultsMap = useSpinStore((s) => s.forcedResults);
  useEffect(() => {
    if (!pendingSpin) return;
    if (forcedResultsMap.size === 0) return;
    setIsSpinning(true);
    packDrawingViewRef.current?.spin();
    setPendingSpin(false);
  }, [pendingSpin, forcedResultsMap]);


  // Create allItems from packItems for spinning


  const handlePackSelect = async (selectedPackId: string, count: number) => {
    setIsPageLoading(true);
    try {
      // Fetch pack details (includes items)
      const packDetails = await getPackDetails(selectedPackId);
      setSelectedPacks([...selectedPacks, packDetails]);
    } catch (error) {
      console.error("Error fetching case data:", error);
    } finally {
      setIsPageLoading(false);
    }
  };

  const handlePackRemove = (packIdToRemove: string) => {
    setSelectedPacks((prev) => prev.filter((p) => p.id !== packIdToRemove));
  };

  const handleQuantityChange = (qty: number) => {
    const next = Math.max(1, Math.min(15, qty));
    setQuantity(next);
    // Drawer slots unchanged; only how many times we open them
  };


  const handleDemoSpin = () => {
    if (selectedPacks.length === 0) return;
    clearAllResults();
    setIsSpinning(true);
    packDrawingViewRef.current?.spin();
  };

  // Total cost = (sum of selected pack prices) × quantity (open this set N times)
  const totalPrice =
    selectedPacks.reduce((sum, p) => sum + parseFloat(p.price.replace("$", "")), 0) * quantity;

  const handleOpenPacks = async () => {
    if (selectedPacks.length === 0) return;
    if (quantity < 1) return;
    if (isOpening) return;
    if (isSpinning || pendingSpin) return;

    if(totalPrice>10000){addToast({title:"$10,000 maximum",description:"Reduce the selected cases or quantity before opening.",color:"danger"});return;}
    // Validate balance before starting
    try {
      const wallet = await getWalletBalance();
      const balanceRaw = wallet?.balance ?? useAuthStore.getState().user?.walletBalance ?? 0;
      const balance = typeof balanceRaw === "string"
        ? parseFloat(String(balanceRaw).replace(/[$,]/g, "")) || 0
        : Number(balanceRaw) || 0;
      if (balance < totalPrice) {
        addToast({
          title: "Insufficient balance",
          description: `You need $${totalPrice.toFixed(2)} but your balance is $${balance.toFixed(2)}.`,
          color: "danger",
        });
        return;
      }
    } catch (e) {
      addToast({
        title: "Could not verify balance",
        description: "Please try again.",
        color: "danger",
      });
      return;
    }

    // Single open: use existing drawer session (current behavior)
    if (quantity === 1 && drawerReady) {
      setIsOpening(true);
      try {
        clearAllResults();
        const openIntentId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `open_${Date.now()}`;
        const packIds = getDrawerPackIds();
        const opened = await drawerOpen(drawerSessionId, openIntentId, packIds);
        setLastOpenResults(opened.results);
        if (opened.nextRound) {
          const ordered = [...opened.nextRound.instances].sort((a, b) => a.slotIndex - b.slotIndex);
          nextDrawerSessionRef.current = {
            drawerSessionId: opened.nextRound.drawerSessionId,
            instances: ordered.map((x) => ({
              slotIndex: x.slotIndex,
              packInstanceId: x.packInstanceId,
              serverSeedHash: x.serverSeedHash,
              pack: x.pack,
            })),
          };
        } else {
          nextDrawerSessionRef.current = null;
        }
        const nonCurrency = (opened.results || []).filter(
          (r) => (r as any)?.reward?.type !== "CURRENCY"
        );
        if (nonCurrency.length > 0) {
          const names = nonCurrency.map((r) => (r as any)?.reward?.name).filter(Boolean);
          const preview = names.slice(0, 3).join(", ");
          setPendingOpenToast({
            title: "Added to cart",
            description:
              names.length <= 3
                ? preview
                : `${names.length} items added to cart.`,
            color: "success",
          });
        } else {
          setPendingOpenToast({
            title: "Reward credited",
            description: "Your reward was credited to your balance.",
            color: "success",
          });
        }
        const forced: Array<APIPackItem | null> = packIds.map((_, slotIndex) => {
          const result = opened.results.find((r) => r.slotIndex === slotIndex);
          if (!result) return null;
          const slotPack = selectedPacks[slotIndex];
          return slotPack?.items?.find((it) => it.id === result.selectedPackRewardId) ?? null;
        });
        clearAllResults();
        setTimeout(() => {
          setForcedResults(forced);
          setPendingSpin(true);
        }, 10);
        setResetDrawerAfterSpin(true);
      } catch (e: any) {
        console.error("Open cases failed:", e);
        addToast({
          title: "Open cases failed",
          description: e?.response?.data?.error?.message ?? e?.message ?? "Unknown error",
          color: "danger",
        });
      } finally {
        setIsOpening(false);
      }
      return;
    }

    // Loop: open selected pack(s) quantity times with delay between each
    isOpeningLoopRef.current = true;
    const packIdsPerRound = selectedPacks.map((p) => p.id);
    const totalRounds = quantity;
    setOpenLoopTotal(totalRounds);
    setOpenLoopRemaining(totalRounds);
    setIsOpening(true);

    const allResults: DrawerOpenResult[] = [];
    const delayMs = 1800;

    const runOneRound = async (roundIndex: number): Promise<void> => {
      const sessionId = createNewDrawerSessionId();
      const openIntentId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `open_${Date.now()}_${roundIndex}`;

      const init = await drawerInit(sessionId, packIdsPerRound);
      const ordered = [...init.instances].sort((a, b) => a.slotIndex - b.slotIndex);
      const roundPacks = ordered.map((x) => x.pack);
      const seedMap: Record<number, string> = {};
      const instanceMap: Record<number, string> = {};
      for (const inst of ordered) {
        seedMap[inst.slotIndex] = inst.serverSeedHash;
        instanceMap[inst.slotIndex] = inst.packInstanceId;
      }

      setDrawerSessionId(sessionId);
      setSelectedPacks(roundPacks);
      setSlotSeedHashes(seedMap);
      setSlotPackInstanceIds(instanceMap);
      setDrawerReady(true);
      nextDrawerSessionRef.current = null;

      const opened = await drawerOpen(sessionId, openIntentId, packIdsPerRound);
      allResults.push(...opened.results);
      setLastOpenResults(opened.results);

      const forced: Array<APIPackItem | null> = packIdsPerRound.map((_, slotIndex) => {
        const result = opened.results.find((r) => r.slotIndex === slotIndex);
        if (!result) return null;
        const slotPack = roundPacks[slotIndex];
        return slotPack?.items?.find((it) => it.id === result.selectedPackRewardId) ?? null;
      });

      clearAllResults();
      setTimeout(() => {
        setForcedResults(forced);
        setPendingSpin(true);
      }, 10);

      await new Promise<void>((resolve) => {
        spinCompleteResolveRef.current = resolve;
      });
      setOpenLoopRemaining((prev) => Math.max(0, prev - 1));
    };

    try {
      for (let i = 0; i < totalRounds; i++) {
        await runOneRound(i);
        if (i < totalRounds - 1) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      const nonCurrency = allResults.filter(
        (r) => (r as any)?.reward?.type !== "CURRENCY"
      );
      const itemNames = nonCurrency.map((r) => (r as any)?.reward?.name).filter(Boolean);
      const preview = itemNames.slice(0, 5).join(", ");
      const totalItems = nonCurrency.length;
      addToast({
        title: `Opened ${totalRounds} case${totalRounds === 1 ? "" : "s"}`,
        description:
          totalItems === 0
            ? "Rewards credited to your balance."
            : totalItems <= 5
              ? preview
              : `${totalItems} items added to cart.`,
        color: "success",
      });
    } catch (e: any) {
      console.error("Open cases failed:", e);
      addToast({
        title: "Open cases failed",
        description: e?.response?.data?.error?.message ?? e?.message ?? "Unknown error",
        color: "danger",
      });
    } finally {
      isOpeningLoopRef.current = false;
      setIsOpening(false);
      setOpenLoopRemaining(0);
      setOpenLoopTotal(0);
      setDrawerReady(false);
      setDrawerSessionId(createNewDrawerSessionId());
    }
  };

  const handleSpinComplete = async (results: any) => {
    setIsSpinning(false);

    const inLoop = spinCompleteResolveRef.current != null;
    if (inLoop) {
      spinCompleteResolveRef.current?.();
      spinCompleteResolveRef.current = null;
    } else {
      if (pendingOpenToast) {
        addToast(pendingOpenToast);
        setPendingOpenToast(null);
      }
      if (resetDrawerAfterSpin) {
        const applied = applyNextDrawerSessionIfReady();
        if (!applied) {
          setDrawerReady(false);
        }
      }
    }

    try {
      const [wallet, cart, freshUser] = await Promise.all([
        getWalletBalance(),
        getCartItems("AVAILABLE"),
        getCurrentUser(),
      ]);
      updateUser({
        walletBalance: wallet?.balance,
        cartCount: cart?.length,
        ...(freshUser && {
          totalExperience: freshUser.totalExperience,
          level: freshUser.level,
          levelProgress: freshUser.levelProgress,
        }),
      });
    } catch {
      // ignore stats refresh failures
    }
  };

  // Show loading state while fetching pack
  if (isPageLoading || !pack) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-screen bg-background-base">
        <div className="text-white">Loading case...</div>
      </div>
    );
  }

  return (
    <div data-pack-opening="v3" className="flex flex-col items-center w-full min-h-screen bg-background-base relative">
      <div data-pack-nav="true" className="w-full max-w-7xl px-4 md:px-5 relative">
        {/* Back Button */}
        <div className="w-full max-w-7xl px-4 md:px-5 pt-4 absolute top-0 left-0">
          <Link href="/cases">
            <Button className="bg-[rgba(63,71,84,0.24)] hover:bg-[rgba(63,71,84,0.32)] rounded-full h-8">
              <Icon name="arrow-left" className="w-4 h-4" />
              <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                All Cases
              </span>
            </Button>
          </Link>
        </div>
      </div>
<PackOpeningTitle packs={selectedPacks} fast={fastOpen}/>

      <div data-pack-fast="true" className="flex w-full max-w-7xl justify-end px-5 pt-5"><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"><input type="checkbox" checked={fastOpen} disabled={isOpening} onChange={e=>setFastOpen(e.target.checked)}/> Fast open</label></div>
      {/* Pack Drawing View */}
      <div data-pack-stage="true" className="relative w-full">
        <PackDrawingView
          ref={packDrawingViewRef}
          selectedPacks={selectedPacks}
          onSpinComplete={handleSpinComplete}
          winSound="basic"
          fastOpen={fastOpen}
        />
        {/* {(isOpening || (!drawerReady && !isPageLoading)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
            <div className="text-white text-sm">
              {isOpening && "Opening..."}
            </div>
          </div>
        )} */}
      </div>

      {/* Pack Details Section */}
      <div data-pack-details="true" className="flex flex-col items-center gap-6 w-full max-w-7xl mx-auto px-4 py-6">
        {/* Pack Details Controls */}
        {selectedPacks.length > 0 && (
          <div className="relative w-full">
            <PackDetails
              selectedPacks={selectedPacks}
              quantity={quantity}
              onQuantityChange={handleQuantityChange}
              onOpenPacks={handleOpenPacks}
              onDemoSpin={handleDemoSpin}
              openLoopRemaining={openLoopRemaining}
              openLoopTotal={openLoopTotal}
              isOpening={isOpening}
            />
            {/* {drawerReady && (
              <div className="mt-3 flex flex-col gap-2 text-xs text-text-muted">
                {selectedPacks.map((p, idx) => (
                  <div key={`${p.id}-${idx}`} className="flex flex-row gap-2 items-center">
                    <span className="text-white">{p.name}</span>
                    <span className="font-mono break-all">
                      {slotSeedHashes[idx] ? `Server seed hash: ${slotSeedHashes[idx]}` : "Server seed hash: ..."}
                    </span>
                  </div>
                ))}
              </div>
            )} */}
          </div>
        )}

        {/* Pack Slots */}
        <PackSlots
          selectedPacks={selectedPacks}
          totalSlots={6}
          onSlotClick={() => setIsModalOpen(true)}
          updateSelectedPacks={setSelectedPacks}
          slotSeedHashes={slotSeedHashes}
        />

        {/* Items Section */}
        {selectedPacks.length > 0 && (
          <div className="flex flex-col items-start gap-4 w-full">
            <div className="flex flex-row justify-between items-center w-full">
              <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-text-muted">
                Items
              </span>
            </div>

            {selectedPacks.map((selectedPack, idx) => (
              <div key={idx} className="flex flex-col items-start gap-2 w-full">
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  {selectedPack.name}
                </span>
                {(() => {
                  const normalizeOdds = (it: APIPackItem): number => {
                    const raw = (it as any)?.metadata?.probability;
                    const n = typeof raw === "number" ? raw : Number(raw);
                    if (!Number.isFinite(n)) return 0;
                    // tolerate 0..100
                    const p = n > 1 ? n / 100 : n;
                    return Math.max(0, Math.min(1, p));
                  };

                  const parseValue = (it: APIPackItem): number => {
                    const raw = (it as any)?.template?.value ?? it.price ?? "0";
                    const s = typeof raw === "string" ? raw.replace("$", "").trim() : String(raw);
                    const n = Number.parseFloat(s);
                    return Number.isFinite(n) ? n : 0;
                  };

                  const parseName = (it: APIPackItem): string =>
                    String((it as any)?.template?.name ?? it.name ?? "");

                  // Sort rules:
                  // 1) odds low -> high
                  // 2) price/value high -> low (when odds same)
                  // 3) name A -> Z (when odds+price same)
                  const sortedItems = [...(selectedPack.items ?? [])].sort((a, b) => {
                    const oa = normalizeOdds(a);
                    const ob = normalizeOdds(b);
                    if (oa !== ob) return oa - ob;

                    const va = parseValue(a);
                    const vb = parseValue(b);
                    if (va !== vb) return vb - va;

                    const na = parseName(a);
                    const nb = parseName(b);
                    const nameCmp = na.localeCompare(nb, "en", { sensitivity: "base" });
                    if (nameCmp !== 0) return nameCmp;

                    return String(a.id ?? "").localeCompare(String(b.id ?? ""), "en", { sensitivity: "base" });
                  });

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 w-full">
                      {sortedItems.map((item, index) => (
                        <PackItemCard
                          key={item.id ?? index}
                          {...item}
                          item={item}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pack Selector Modal */}
      <PackSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedPacks={selectedPacks}
        updateSelectedPacks={setSelectedPacks}
      />
    </div>
  );
}
