"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button, Input, Image, Slider, cn } from "@heroui/react";
import { addToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import {
  getUpgraderItemsPage,
  getUpgraderProvablyFairSeed,
  demoSpinUpgrader,
  spinUpgrader,
  startTicketFromAngle,
  type UpgraderItem,
  type UpgraderFilters,
  type UpgraderProvablyFairSeed,
} from "@/lib/api/upgrader";
import { formatPrice } from "@/lib/utils/format";
import { cleanNumber, formatPercent } from "@/lib/utils/numbers";
import PriceRangeFilter from "@/components/packs/PriceRangeFilter";
import { useAuthStore } from "@/store/auth.store";
import JackpotWheel, { type JackpotWheelSegment } from "@/components/battles/JackpotWheel";
import PackItemCard from "../ui/PackItem";
import { PackItem } from "@/lib/api/packs";
import ActionButton from "../ui/ActionButton";
import ControlableJackpotWheel from "../battles/ControlableJackpotWheel";
import CircleSlider from "./CircleSlider";
import Fireworks from "react-canvas-confetti/dist/presets/fireworks";
import { playExtraWin, playUpgradeFail, unlockAudio } from "@/lib/audio";

export function UpgraderPage() {
  const [items, setItems] = useState<UpgraderItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<UpgraderItem | null>(null);
  const [outcome, setOutcome] = useState(60); // default 60%
  const [startAngle, setStartAngle] = useState(0); // green arc start (degrees, 0 = top, clockwise)
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<"Price - Low to high" | "Price - High to low" | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isDemoSpinning, setIsDemoSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<"won" | "lost" | null>(null);
  const [pfSeed, setPfSeed] = useState<UpgraderProvablyFairSeed | null>(null);
  const [lastTicketNumber, setLastTicketNumber] = useState<number | null>(null);
  const [lastOutcomeUsed, setLastOutcomeUsed] = useState<number | null>(null);
  const [wheelKey, setWheelKey] = useState(0);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated } = useAuthStore();
  const [itemPrice, setItemPrice] = useState<string>("");
  const [showResult, setShowResult] = useState(false);
  const fireworksConductorRef = useRef<{ run: (params: { speed: number; duration?: number; delay?: number }) => void } | null>(null);

  const ITEMS_PER_PAGE = 30;

  // Sync itemPrice from outcome % when outcome or selectedItem changes
  useEffect(() => {
    if (selectedItem) {
      const raw = parseFloat(selectedItem.price) * outcome / 100;
      setItemPrice(cleanNumber(raw, 4).toString());
    }
  }, [selectedItem, outcome]);

  // When user edits itemPrice, derive outcome % (bidirectional sync)
  const handleItemPriceChange = (value: string) => {
    setItemPrice(value);
    if (selectedItem) {
      const basePrice = parseFloat(selectedItem.price);
      const entered = parseFloat(value);
      if (Number.isFinite(basePrice) && basePrice > 0 && Number.isFinite(entered) && entered >= 0) {
        const pct = (entered / basePrice) * 100;
        const clamped = Math.min(80, Math.max(5, pct));
        setOutcomeAndResetWheel(Math.round(clamped));
      }
    }
  };






  // Fetch items on mount and when filters change
  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        const filters: UpgraderFilters = {
          search: searchQuery || undefined,
          sort: sort || undefined,
          priceRange: priceRange ? `${priceRange[0]}-${priceRange[1]}` : undefined,
          limit: ITEMS_PER_PAGE,
          offset,
        };
        const data = await getUpgraderItemsPage(filters);
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
      } catch (error) {
        console.error("Error fetching upgrader items:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, [searchQuery, sort, priceRange, page]);

  const spinPrice = useMemo(() => {
    if (!selectedItem) return 0;
    const itemPrice = parseFloat(selectedItem.price);
    if (!Number.isFinite(itemPrice) || itemPrice <= 0) return 0;
    const pct = Math.min(80, Math.max(5, outcome));
    return cleanNumber(itemPrice * (pct / 100), 4);
  }, [selectedItem, outcome]);

  const wheelOutcome = useMemo(() => lastOutcomeUsed ?? outcome, [lastOutcomeUsed, outcome]);

  const setOutcomeAndResetWheel = (next: number) => {
    setOutcome(next);
    // If user changes outcome after a spin, unlock wheel segments and reset the last result
    // so `wheelSegments` reflects the current outcome.
    setLastOutcomeUsed(null);
    setLastTicketNumber(null);
    setLastResult(null);
    setWheelKey((k) => k + 1);
  };

  const wheelSegments = useMemo<JackpotWheelSegment[]>(() => {
    const end = Math.max(1, Math.min(1_000_000, Math.floor((wheelOutcome / 100) * 1_000_000)));
    return [
      { id: "win", label: "Win", color: "#d83e4a", startTicket: 1, endTicket: end },
      { id: "lose", label: "Lose", color: "#4d4e523D", startTicket: end + 1, endTicket: 1_000_000 },
    ].filter((s) => s.startTicket <= s.endTicket);
  }, [wheelOutcome]);

  // Fetch a provably-fair commit (serverSeedHash + nonce) when a user selects an item.
  useEffect(() => {
    if (!isAuthenticated) {
      setPfSeed(null);
      return;
    }
    if (!selectedItem) {
      setPfSeed(null);
      return;
    }
    // Only refresh when selection changes (not on every outcome change).
    getUpgraderProvablyFairSeed()
      .then(setPfSeed)
      .catch((e) => {
        console.error("Failed to get upgrader provably-fair seed:", e);
        setPfSeed(null);
      });
  }, [isAuthenticated, selectedItem?.id]);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    if (isSortOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSortOpen]);

  const handleItemSelect = (item: UpgraderItem) => {
    setSelectedItem(item);
    setOutcome(46.3);
    setLastResult(null);
    setLastTicketNumber(null);
    setLastOutcomeUsed(null);
  };

  const handleReset = () => {
    setSelectedItem(null);
    setLastResult(null);
    setLastTicketNumber(null);
    setLastOutcomeUsed(null);
    setPfSeed(null);
    setOutcome(46.3);

  };

  const handleSpin = async () => {
    if (!selectedItem) {
      addToast({
        title: "Select a product",
        description: "Please select a product to spin.",
        color: "warning",
      });
      return;
    }
    if (!isAuthenticated) {
      addToast({
        title: "Login required",
        description: "Please sign in to use the upgrader.",
        color: "warning",
      });
      return;
    }
    const pct = Math.min(80, Math.max(5, outcome));
    if (spinPrice <= 0) return;
    if(spinPrice>10000){addToast({title:"$10,000 maximum",description:"Choose a lower stake before spinning.",color:"danger"});return;}
    if (!pfSeed?.commitId) {
      try {
        const seed = await getUpgraderProvablyFairSeed();
        setPfSeed(seed);
      } catch (e) {
        console.error("Failed to get provably-fair seed:", e);
        addToast({
          title: "Fairness error",
          description: "Failed to prepare provably-fair seed. Please try again.",
          color: "danger",
        });
        return;
      }
    }

    unlockAudio();
    setIsSpinning(true);
    setLastResult(null);
    setLastTicketNumber(null);
    setLastOutcomeUsed(null);
    try {
      const intentId = crypto.randomUUID();
      const res = await spinUpgrader({
        intentId,
        productId: selectedItem.id,
        outcomePct: pct,
        startTicket: startTicketFromAngle(startAngle),
        commitId: (pfSeed as any)?.commitId,
      });
      setLastResult(res.won ? "won" : "lost");
      setLastTicketNumber(res.ticketNumber);
      setLastOutcomeUsed(res.outcomePct);
      setWheelKey((k) => k + 1); // force JackpotWheel remount/spin
      // Prepare next commit for the next spin (best-effort)
      try {
        const next = await getUpgraderProvablyFairSeed();
        setPfSeed(next);
      } catch {
        // ignore
      }

    } catch (error: any) {
      console.error("Upgrader spin failed:", error);
      addToast({
        title: "Spin failed",
        description: error?.response?.data?.message || error?.message || "Please try again.",
        color: "danger",
      });
    } finally {
      setIsSpinning(false);
    }
  };

  const handleDemoSpin = async () => {
    if (!selectedItem) {
      addToast({
        title: "Select a product",
        description: "Please select a product to demo spin.",
        color: "warning",
      });
      return;
    }
    if (!isAuthenticated) {
      addToast({
        title: "Login required",
        description: "Please sign in to use the upgrader.",
        color: "warning",
      });
      return;
    }

    const pct = Math.min(80, Math.max(5, outcome));
    if (spinPrice <= 0) return;
    if(spinPrice>10000){addToast({title:"$10,000 maximum",description:"Choose a lower stake before spinning.",color:"danger"});return;}

    if (!pfSeed?.commitId) {
      try {
        const seed = await getUpgraderProvablyFairSeed();
        setPfSeed(seed);
      } catch (e) {
        console.error("Failed to get provably-fair seed:", e);
        addToast({
          title: "Fairness error",
          description: "Failed to prepare provably-fair seed. Please try again.",
          color: "danger",
        });
        return;
      }
    }

    unlockAudio();
    setIsDemoSpinning(true);
    setLastResult(null);
    setLastTicketNumber(null);
    setLastOutcomeUsed(null);

    try {
      const res = await demoSpinUpgrader({
        productId: selectedItem.id,
        outcomePct: pct,
        startTicket: startTicketFromAngle(startAngle),
        commitId: (pfSeed as any)?.commitId,
      });

      setLastResult(res.won ? "won" : "lost");
      setLastTicketNumber(res.ticketNumber);
      setLastOutcomeUsed(res.outcomePct);
      setWheelKey((k) => k + 1);

      // Prepare next commit for the next demo spin (best-effort)
      try {
        const next = await getUpgraderProvablyFairSeed();
        setPfSeed(next);
      } catch {
        // ignore
      }

      // addToast({
      //   title: "Demo Spin",
      //   description: res.won ? "Demo result: WIN" : "Demo result: LOSS",
      //   color: res.won ? "success" : "danger",
      // });
    } catch (error: any) {
      console.error("Upgrader demo spin failed:", error);
      addToast({
        title: "Demo spin failed",
        description: error?.response?.data?.message || error?.message || "Please try again.",
        color: "danger",
      });
    } finally {
      setIsDemoSpinning(false);
    }
  };

  const onSpinEnd = () => {
    if (lastResult === "won") {
      playExtraWin();
      fireworksConductorRef.current?.run({ speed: 2, duration: 2500 });
    } else {
      playUpgradeFail();
    }
    addToast({
      title: lastResult === "won" ? "Success!" : "Failed",
      description: lastResult === "won" ? "Item added to your cart." : "No reward this time.",
      color: lastResult === "won" ? "success" : "danger",
    });
  };

  return (
    <>
      <Fireworks
        width="100%"
        height="100%"
        style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999 }}
        onInit={({ conductor }) => {
          fireworksConductorRef.current = conductor;
        }}
      />
    <div className="flex flex-col items-center w-full pt-20 pb-10 min-h-screen px-4 md:px-0">
      {/* Hero Section with Spinner */}
      <div className="w-full grid grid-cols-1 max-w-7xl md:grid-cols-3 bg-[#0f1013] border-b border-[rgba(63,71,84,0.24)] relative  items-center justify-center gap-5 p-5">
        {/* Left Panel - Controls */}
        <div className="w-full md:max-w-[500px] mx-auto  h-auto md:h-[340px] bg-[rgba(63,71,84,0.12)] rounded-lg p-5 flex flex-col gap-3 order-2 md:order-1">
          <div className="flex flex-col flex-1 gap-3">
            {/* Spin Price (derived) */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-row justify-between items-center">
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  Spin price
                </span>
                {/* <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  ${formatPrice(spinPrice.toString())}
                </span> */}
              </div>
              <Input
                value={itemPrice}
                onValueChange={handleItemPriceChange}
                startContent={`$`}
                classNames={{
                  inputWrapper: "bg-background-base border-0 rounded-sm h-9 flex-1",
                }}
                max={selectedItem?.price}
                min={selectedItem?.price ? parseFloat(selectedItem.price) * 0.2 : 0}
              />
            </div>

            {/* Outcome */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-row justify-between items-center">
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  Outcome
                </span>
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  {formatPercent(outcome, 2, false)}
                </span>
              </div>
              <div className="flex flex-row items-center gap-1 px-1  rounded-md h-9">
                <Slider
                  aria-label="Outcome percent"
                  className="max-w-md"
                  color="foreground"
                  size="lg"
                  value={outcome}
                  onChange={(value) => {
                    setOutcomeAndResetWheel(value as number);
                  }}
                  minValue={1}
                  maxValue={80}
                  classNames={{
                    base: 'rounded-md',
                    trackWrapper: "rounded-md!",
                    track: "rounded-md! h-9 bg-background-base border border-none",
                    filler: "bg-transparent"
                  }}
                  renderThumb={(props) => (
                    <div
                      {...props}
                      className="group top-1/2  shadow-medium  cursor-grab "
                    >
                      <span className="transition-transform bg-text-muted shadow-small  rounded-xs w-4 h-7 block group-data-[dragging=true]:scale-80" />
                    </div>
                  )}
                />
              </div>
            </div>

            {/* Percentage Quick Select */}
            <div className="flex flex-wrap lg:grid grid-cols-5 items-center gap-0.5">
              <Button
                onPress={() => setOutcomeAndResetWheel(5)}
                className="h-[30px] px-2 min-w-0 bg-[rgba(63,71,84,0.24)] border border-[rgba(63,71,84,0.24)] rounded-full"
              >
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  Min
                </span>
              </Button>
              <Button
                onPress={() => setOutcomeAndResetWheel(10)}
                className="h-[30px] px-2 min-w-0 bg-[rgba(63,71,84,0.24)] border border-[rgba(63,71,84,0.24)] rounded-full"
              >
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  10%
                </span>
              </Button>
              <Button
                onPress={() => setOutcomeAndResetWheel(20)}
                className="h-[30px] px-2 min-w-0 bg-[rgba(63,71,84,0.24)] border border-[rgba(63,71,84,0.24)] rounded-full"
              >
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  20%
                </span>
              </Button>
              <Button
                onPress={() => setOutcomeAndResetWheel(50)}
                className="h-[30px] px-2 min-w-0 bg-[rgba(63,71,84,0.24)] border border-[rgba(63,71,84,0.24)] rounded-full"
              >
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  50%
                </span>
              </Button>
              <Button
                onPress={() => setOutcomeAndResetWheel(80)}
                className="h-[30px] px-2 min-w-0 bg-[rgba(63,71,84,0.24)] border border-[rgba(63,71,84,0.24)] rounded-full"
              >
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  Max
                </span>
              </Button>
            </div>
          </div>
          {/* Reset Button */}
          <Button
            onPress={handleReset}
            className="h-9 px-3 bg-[rgba(63,71,84,0.24)] rounded-full w-full"
          >
            <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
              Reset
            </span>
          </Button>
        </div>

        {/* Center - Spinner */}
        <div className="w-full flex flex-col items-center gap-7 order-1 md:order-2">
          {/* Spinner */}
          <div className="relative w-auto">
            <span className={`z-40 absolute hidden whitespace-nowrap left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 leading-[15px] tracking-[-0.02em] font-medium ${selectedItem ? "text-white text-lg" : "text-white/40 text-xs "}`}>{selectedItem ? formatPercent(outcome, 2, false) : "Select a product below to get started"}</span>
            <div className="scale-[0.8] origin-center">

              <CircleSlider
                value={outcome}
                onChange={setOutcomeAndResetWheel}
                startAngle={startAngle}
                onStartAngleChange={setStartAngle}
                spinAngle={
                  lastTicketNumber != null
                    ? ((lastTicketNumber - 1) / 1_000_000) * 360
                    : null
                }
                spinDurationMs={6500}
                spins={8}
                onSpinEnd={() => {
                  setShowResult(true);
                  onSpinEnd();
                }}
                size={320}
              />
            </div>
          </div>

          {/* {pfSeed?.serverSeedHash ? (
            <div className="text-xs text-[#6c6c71] max-w-[320px] text-center break-all">
              Server seed hash: {pfSeed.serverSeedHash}
            </div>
          ) : null} */}

          {/* Demo Spin Button */}
          <div className="flex flex-col sm:flex-row w-full items-center justify-center gap-2">

            <ActionButton onClick={handleSpin} disabled={spinPrice === 0 || isSpinning}>
              <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                Spin for ${formatPrice(spinPrice.toString())}
              </span>
            </ActionButton>
            <ActionButton onClick={handleDemoSpin} color="secondary" disabled={isDemoSpinning}
              isLoading={isDemoSpinning}>
              <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                Demo Spin
              </span>
              <Icon name="dice-faces" className="w-4 h-4 text-[#6c6c71]" isActive />
            </ActionButton>
            
          </div>
        </div>

        {/* Right Panel - Empty State or Selected Item Display */}
        <div className="w-full md:max-w-[500px] h-auto mx-auto md:h-[340px] bg-[rgba(63,71,84,0.12)] rounded-lg p-5 flex flex-col items-center justify-center gap-5 order-3">
          {!selectedItem ? (
            <>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" className="w-10 h-10 text-[#6c6c71]">
                <path d="M20 8L20 32M20 32L8 20M20 32L32 20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {/* <span className="text-sm hidden leading-[15px] tracking-[-0.02em] font-medium text-white text-center w-[219px]">
                Select a product below to get started
              </span> */}
            </>
          ) : (
            <>
              <div className="w-1/2 aspect-square bg-[rgba(63,71,84,0.12)] rounded-lg flex items-center justify-center relative">
                <Image
                  src={selectedItem.image}
                  alt={selectedItem.name}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71] text-center">
                  {selectedItem.name}
                </span>
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white text-center">
                  ${formatPrice(selectedItem.price)}
                </span>
                {/* {lastResult && (
                  <span
                    className={cn(
                      "text-xs leading-[13px] tracking-[-0.02em] font-medium text-center mt-2",
                      lastResult === "won" ? "text-[#4ade80]" : "text-[#ef4444]"
                    )}
                  >
                    {lastResult === "won" ? "Winner" : "Try again"}
                  </span>
                )} */}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="w-full max-w-4xl mx-auto mt-5 flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <Input
          type="text"
          value={searchQuery}
          onValueChange={(v) => {
            setSearchQuery(v);
            setPage(1);
          }}
          placeholder="Search"
          startContent={<Icon name="search" className="w-5 h-5 text-[#6c6c71]" />}
          classNames={{
            inputWrapper: "bg-[rgba(63,71,84,0.12)] border-0 rounded-full h-9 flex-1",
            input: "text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]",
          }}
          className="flex-1"
        />

        <div className="flex flex-row gap-2 w-full sm:w-auto">
          {/* Sort Dropdown */}
          <div className="relative w-full sm:w-auto" ref={sortRef}>
            <Button
              onPress={() => setIsSortOpen(!isSortOpen)}
              className="h-9 px-3 bg-[rgba(63,71,84,0.12)] rounded-full w-full sm:w-auto"
            >
              <div className="flex flex-row items-center gap-2 flex-1">
                <Icon name="sorting" className="w-4 h-4 text-[#6c6c71]" />
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  {sort || "Price - Low to high"}
                </span>
              </div>
              <Icon name="chevron-down" className="w-4 h-4 text-[#6c6c71]" />
            </Button>

            {/* Sort Dropdown Menu */}
            {isSortOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsSortOpen(false)}
                />
                <div className="absolute top-full left-0 mt-2 z-20 w-full sm:w-[194px] bg-[#1e1f23] border border-[rgba(63,71,84,0.24)] rounded-lg shadow-[0px_0px_20px_4px_rgba(0,0,0,0.4)] p-0.5 flex flex-col gap-0.5">
                  {/* Price - Low to high */}
                  <button
                    onClick={() => {
                      setSort("Price - Low to high");
                      setPage(1);
                      setIsSortOpen(false);
                    }}
                    className={`flex flex-row justify-between items-center px-2.5 py-2 gap-2 w-full h-8 rounded-md transition-colors ${sort === "Price - Low to high" || (!sort && true)
                      ? "bg-[rgba(63,71,84,0.24)]"
                      : "hover:bg-[rgba(63,71,84,0.12)]"
                      }`}
                  >
                    <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white/92">
                      Price - Low to high
                    </span>
                    {(sort === "Price - Low to high" || !sort) && (
                      <Icon name="check" className="w-4 h-4 text-white/92 shrink-0" />
                    )}
                  </button>

                  {/* Price - High to low */}
                  <button
                    onClick={() => {
                      setSort("Price - High to low");
                      setPage(1);
                      setIsSortOpen(false);
                    }}
                    className={`flex flex-row justify-between items-center px-2.5 py-2 gap-2 w-full h-8 rounded-md transition-colors ${sort === "Price - High to low"
                      ? "bg-[rgba(63,71,84,0.24)]"
                      : "hover:bg-[rgba(63,71,84,0.12)]"
                      }`}
                  >
                    <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white/92">
                      Price - High to low
                    </span>
                    {sort === "Price - High to low" && (
                      <Icon name="check" className="w-4 h-4 text-white/92 shrink-0" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Price Range Dropdown */}
          <div className="w-full sm:w-auto">
            <PriceRangeFilter
              min={0}
              max={items.length > 0 ? cleanNumber(Math.max(...items.map(item => parseFloat(item.price) || 0), 1000), 2) : 1000}
              onChange={(value) => {
                setPriceRange(value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="w-full max-w-4xl mx-auto mt-5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {items.map((item, idx) => {
          const isSelected = selectedItem?.id === item.id;
          return (
            <PackItemCard item={item as PackItem} key={idx} onClick={() => handleItemSelect(item)} />
          );
        })}
      </div>

      {/* Pagination */}
      {total > ITEMS_PER_PAGE && (
        <div className="w-full max-w-4xl mx-auto mt-6 flex items-center justify-between">
          <div className="text-sm text-[#6c6c71]">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, total)} of {total}
          </div>
          <div className="flex gap-2">
            <Button
              onPress={() => setPage((p) => Math.max(1, p - 1))}
              isDisabled={page === 1}
              className="h-9 px-4 rounded-full bg-[rgba(63,71,84,0.24)] disabled:opacity-50"
            >
              <span className="text-sm text-white">Previous</span>
            </Button>
            <Button
              onPress={() => setPage((p) => Math.min(Math.ceil(total / ITEMS_PER_PAGE), p + 1))}
              isDisabled={page >= Math.ceil(total / ITEMS_PER_PAGE)}
              className="h-9 px-4 rounded-full mcPrimary disabled:opacity-50"
            >
              <span className="text-sm text-white">Next</span>
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
