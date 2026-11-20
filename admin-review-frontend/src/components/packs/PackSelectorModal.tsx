"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Modal, ModalContent, ModalBody, ModalHeader, ModalFooter, Button } from "@heroui/react";
import artStyles from "./PackSelectorArt.module.css";
import { Icon } from "@/components/ui/Icon";
import SearchBar from "./SearchBar";
import FilterButton from "./FilterButton";
import { cn } from "@/lib/utils/cn";
import { getPacks, getPackDetails, type Pack as APIPack, PackDetails, type GetPacksFilters } from "@/lib/api/packs";
import { cleanNumber, formatCurrency } from "@/lib/utils/numbers";

const PACKS_FETCH_DEBOUNCE_MS = 300;

function PackPriceButton({
  pack,
  canAddMore,
  isOutOfStock,
  onClick,
}: {
  pack: APIPack;
  canAddMore: boolean;
  isOutOfStock: boolean;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      aria-label={`Add ${pack.name}`}
      disabled={!canAddMore || isOutOfStock}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "flex flex-row justify-center items-center gap-1 px-3 py-0.5 h-8 w-full rounded-full text-sm leading-[15px] tracking-[-0.02em] font-medium transition-colors",
        canAddMore && !isOutOfStock
          ? "bg-[rgba(63,71,84,0.24)] hover:bg-[rgba(63,71,84,0.4)] text-white"
          : "bg-[rgba(63,71,84,0.12)] text-text-muted cursor-not-allowed"
      )}
    >
      {isOutOfStock ? "Out of stock" : isHovered && canAddMore ? "Add Case" : pack.price}
    </button>
  );
}



interface PackSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPacks: PackDetails[];
  updateSelectedPacks: (packs: PackDetails[]) => void;
  maxPacks?: number;
}

export default function PackSelectorModal({
  isOpen,
  onClose,
  selectedPacks,
  updateSelectedPacks,
  maxPacks = 6,
}: PackSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [packs, setPacks] = useState<APIPack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  // Ordered round ids are the source of truth, including repeated packs.
  const [orderedSelection, setOrderedSelection] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<Record<string, APIPack | PackDetails>>({});
  const [applyError, setApplyError] = useState<string | null>(null);
  const applyLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const localSelection = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const id of orderedSelection) counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, [orderedSelection]);
  const [filters, setFilters] = useState<GetPacksFilters>({
    category: "All",
    sort: "Newest",
  });

  // Fetch packs when modal opens or when user changes filters/search — debounced to avoid
  // multiple requests when modal opens (e.g. PriceRangeFilter sync) or rapid filter changes
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setIsLoading(true);
      (async()=>{
        const found:APIPack[]=[],seen=new Set<string>();let page=1;
        while(!cancelled){
          const response=await getPacks({...filters,search:searchQuery||undefined,page,limit:200});
          if(cancelled)return {packs:[]};
          let added=0;
          for(const pack of response.packs){const id=String(pack.id);if(!seen.has(id)){seen.add(id);found.push(pack);added++;}}
          if(!response.hasMore)return {packs:found};
          if(!added)throw new Error("Case pagination did not advance");
          page++;
        }
        return {packs:[]};
      })()
        .then((response) => {
          if (!cancelled) {
            setPacks(response.packs);
            setCatalog((previous) => ({ ...previous, ...Object.fromEntries(response.packs.map((pack) => [String(pack.id), pack])) }));
          }
        })
        .catch((error) => {
          console.error("Error fetching cases:", error);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, PACKS_FETCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isOpen, filters, searchQuery]);

  // Sync local selection from parent when modal opens
  useEffect(() => {
    if (isOpen) {
      setOrderedSelection(selectedPacks.map((pack) => String(pack.id)));
      setCatalog(Object.fromEntries(selectedPacks.map((pack) => [String(pack.id), pack])));
      setApplyError(null);
    }
  }, [isOpen]); // intentionally only when isOpen; selectedPacks is the initial snapshot when opening

  const getSelectedCount = (packId: string) => localSelection[packId] ?? 0;

  const totalSelectedCount = orderedSelection.length;
  const totalPrice = Object.entries(localSelection).reduce((sum, [packId, count]) => {
    const pack = catalog[packId];
    const price = pack ? cleanNumber(Number(String(pack.price).replace(/[^0-9.-]+/g, "")), 2) : 0;
    return sum + price * count;
  }, 0);

  /** Update local count only; no fetch until Apply */
  const handlePackClick = (pack: APIPack) => {
    if (applyLock.current) return;
    setApplyError(null);
    const id = String(pack.id);
    setCatalog((previous) => ({ ...previous, [id]: pack }));
    setOrderedSelection((previous) => {
      const count = previous.filter((value) => value === id).length;
      if (previous.length >= maxPacks || (pack.stockCount != null && count >= pack.stockCount)) return previous;
      return [...previous, id];
    });
  };

  const handleCountChange = (packId: string, delta: number) => {
    if (applyLock.current) return;
    const id = String(packId);
    if (delta === 1) {
      const pack = catalog[id];
      if (pack) handlePackClick(pack as APIPack);
    } else if (delta === -1) {
      setApplyError(null);
      setOrderedSelection((previous) => {
        const position = previous.lastIndexOf(id);
        return position < 0 ? previous : previous.filter((_, index) => index !== position);
      });
    }
  };

  const handleApply = useCallback(async () => {
    if (applyLock.current) return;
    applyLock.current = true;
    setApplyError(null);
    setIsApplying(true);
    try {
      const order = orderedSelection.slice(0, maxPacks);
      const packIds = [...new Set(order)];
      const detailsList = await Promise.all(packIds.map(async (id) => {
        try {
          const response = await getPackDetails(id);
          const details = response?.data as PackDetails | undefined;
          if (!details || String(details.id) !== id || !details.items?.length) throw new Error("Missing case details");
          return details;
        } catch {
          throw new Error(`Could not load ${catalog[id]?.name || `case #${id}`}. Your selection is saved here. Check your connection and press Retry apply.`);
        }
      }));
      if (!mounted.current) return;
      const detailsById = new Map(packIds.map((id, index) => [id, detailsList[index]]));
      updateSelectedPacks(order.map((id) => detailsById.get(id)!));
      onClose();
    } catch (error) {
      if (mounted.current) setApplyError(error instanceof Error ? error.message : "Could not load the selected cases. Please retry.");
    } finally {
      applyLock.current = false;
      if (mounted.current) setIsApplying(false);
    }
  }, [orderedSelection, catalog, maxPacks, updateSelectedPacks, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        // Only close when modal requests close (open=false)
        if (!open && !applyLock.current) onClose();
      }}
      size="4xl"
      placement="center"
      scrollBehavior="inside"
      isDismissable={!isApplying}
      isKeyboardDismissDisabled={isApplying}
      hideCloseButton={isApplying}
      style={{ width: "calc(100vw - 24px)", maxWidth: "900px", maxHeight: "calc(100dvh - 24px)" }}
      classNames={{ wrapper: "overflow-hidden p-3", base: "m-0 flex min-h-0 flex-col overflow-hidden bg-background-elevated border border-white/10 rounded-2xl" }}
    >
      <ModalContent>
        <ModalHeader className="shrink-0 px-4 py-4 sm:px-5">
          <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
            Select Cases <span className="ml-2 text-xs font-normal text-slate-400">{isLoading?"Loading…":`${packs.length} available`}</span>
          </h2>
        </ModalHeader>
        <ModalBody className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-2 sm:px-5">
          <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="flex flex-col gap-3">
              <SearchBar 
                value={searchQuery}
                onChange={setSearchQuery}
                showCreateButton={false}
              />
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 [&>div]:min-w-0 [&>div]:max-w-full">
                <div role="group" aria-label="Case category" className="flex flex-wrap gap-1">{(["All","Pokemon","CSGO","IRL"] as const).map(category=><button key={category} type="button" aria-pressed={(filters.category||"All")===category} onClick={()=>setFilters(previous=>({...previous,category}))} className={`rounded-lg border px-3 py-2 text-xs ${((filters.category||"All")===category)?"border-purple-400 bg-purple-500/20 text-white":"border-white/10 text-slate-300"}`}>{category==="Pokemon"?"Pokémon":category==="CSGO"?"CS:GO":category}</button>)}</div>
                <FilterButton
                  icon="sort"
                  label="Sort"
                  defaultOption="Newest"
                  value={filters.sort ?? "Newest"}
                  options={["Newest", "Oldest", "Price: Low to High", "Price: High to Low", "Name: A-Z", "Name: Z-A"]}
                  onChange={(value) => setFilters((prev) => ({ ...prev, sort: value as GetPacksFilters["sort"] }))}
                />
                <button type="button" className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300" onClick={()=>{setSearchQuery("");setFilters({category:"All",sort:"Newest"});}}>Reset filters</button>
              </div>
            </div>
            {!isLoading && packs.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No cases match these filters. Your selected cases are still saved.</p>}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="text-text-muted">Loading cases...</span>
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-2 gap-3 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {packs.map((pack) => {
                const count = getSelectedCount(pack.id);
                const isSelected = count > 0;
                const canAddMore = totalSelectedCount < maxPacks && !isApplying;
                const stockCount = pack.stockCount ?? null;
                const isOutOfStock = stockCount !== null && count >= stockCount;
                const canAddByStock = stockCount === null || count < stockCount;

                return (
                  <div key={pack.id} className="flex min-w-0 w-full flex-col items-center gap-2 rounded-xl border border-white/[0.05] bg-black/10 p-2">
                    <div className={`relative h-32 w-full min-w-0 sm:h-40 ${artStyles.art}`}>
                      <img src={pack.image} alt={pack.name} className={artStyles.image} loading="lazy" decoding="async" />
                    </div>
                    <p title={pack.name} className="w-full min-h-[2.5em] break-words text-center text-xs font-semibold text-white">{pack.name}</p>

                    {/* Action Button */}
                    {isSelected ? (
                      <div className="flex h-8 w-full min-w-0 items-center justify-between gap-1 rounded-lg border border-dashed border-white/10 px-0.5">
                        <button
                          aria-label={`Remove one ${pack.name}`}
                          onClick={() => handleCountChange(pack.id, -1)}
                          disabled={isApplying}
                          className="flex items-center justify-center w-7 h-7 bg-[rgba(63,71,84,0.24)] rounded-md shrink-0"
                        >
                          <Icon name="minus" className="w-4 h-4" />
                        </button>
                        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white text-center">
                          {count}
                        </span>
                        <button
                          aria-label={`Add another ${pack.name}`}
                          onClick={() => handleCountChange(pack.id, 1)}
                          disabled={!canAddMore || !canAddByStock}
                          className="flex items-center justify-center w-7 h-7 bg-[rgba(63,71,84,0.24)] rounded-md shrink-0 disabled:opacity-50"
                        >
                          <Icon name="plus" className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <PackPriceButton
                        pack={pack}
                        canAddMore={canAddMore}
                        isOutOfStock={isOutOfStock}
                        onClick={() => handlePackClick(pack)}
                      />
                    )}
                  </div>
                );
                })}
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3 sm:px-5">
          {applyError && <p role="alert" className="w-full rounded-xl border border-red-300/20 bg-red-400/[0.05] px-3 py-2 text-xs leading-relaxed text-red-200">{applyError}</p>}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
              {totalSelectedCount} case{totalSelectedCount !== 1 ? "s" : ""}
            </span>
            <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
              ${formatCurrency(totalPrice)}
            </span>
          </div>
          <Button
            color="primary"
            onPress={handleApply}
            isLoading={isApplying}
            isDisabled={isApplying}
            className="min-w-[100px]"
          >
            {applyError ? "Retry apply" : totalSelectedCount === 0 ? "Clear selection" : "Apply selection"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
