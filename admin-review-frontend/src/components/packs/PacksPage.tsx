"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import SearchBar from "./SearchBar";
import FilterButton from "./FilterButton";
import PriceRangeFilter from "./PriceRangeFilter";
import PackCard from "./PackCard";
import { getPacks, type Pack, type GetPacksFilters, type PackCategory } from "@/components/packs/catalogue-client";
import { Icon } from "@/components/ui/Icon";

import styles from "./PacksCatalog.module.css";

const CATEGORIES: {value:PackCategory;label:string}[] = [{value:"All",label:"All"},{value:"Pokemon",label:"Pokémon"},{value:"CSGO",label:"CS:GO"},{value:"IRL",label:"IRL"}];
const PAGE_SIZE = 24;
const PRICE_MAX = 2500;

const SOURCE_OPTIONS = ["Official", "Community", "All"] as const;
const SORT_OPTIONS = [
  "Newest",
  "Oldest",
  "Price: Low to High",
  "Price: High to Low",
  "Name: A-Z",
  "Name: Z-A",
] as const;
const VOLATILITY_OPTIONS = ["Low", "High", "All"] as const;

type SourceOption = (typeof SOURCE_OPTIONS)[number];
type SortOption = (typeof SORT_OPTIONS)[number];
type VolatilityOption = (typeof VOLATILITY_OPTIONS)[number];

export default function PacksPage() {
  const [category, setCategory] = useState<PackCategory>("All");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [source, setSource] = useState<SourceOption>("All");
  const [sort, setSort] = useState<SortOption>("Newest");
  const [volatility, setVolatility] = useState<VolatilityOption>("All");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, PRICE_MAX]);
  const [priceRangeApplied, setPriceRangeApplied] = useState<[number, number]>([0, PRICE_MAX]);
  const [page, setPage] = useState(1);

  useEffect(()=>{const query=new URLSearchParams(window.location.search).get('search');if(query){setSearch(query.slice(0,100));setSearchDebounced(query.slice(0,100));}},[]);
  // Debounce price range so slider doesn't trigger a fetch on every tick
  useEffect(() => {
    const t = setTimeout(() => setPriceRangeApplied(priceRange), 400);
    return () => clearTimeout(t);
  }, [priceRange]);

  const requestId = useRef(0);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [catalogueError, setCatalogueError] = useState('');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPacks = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setCatalogueError('');
    const filters: GetPacksFilters = {
      category,
      search: searchDebounced || undefined,
      source: source === "All" ? undefined : source,
      sort,
      volatility: volatility === "All" ? undefined : volatility,
      minPrice: priceRangeApplied[0] > 0 ? priceRangeApplied[0] : undefined,
      maxPrice: priceRangeApplied[1] < PRICE_MAX ? priceRangeApplied[1] : undefined,
      page,
      limit: PAGE_SIZE,
    };
    try {
      const res = await getPacks(filters);
      if (id !== requestId.current) return;
      setPacks(res.packs);
      setTotal(res.total);
      setHasMore(res.hasMore);
    } catch (catalogueFailure) {
      if (id !== requestId.current) return;
      setCatalogueError(catalogueFailure instanceof Error ? catalogueFailure.message : 'The catalogue could not be loaded.');
      setPacks([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [category, searchDebounced, source, sort, volatility, priceRangeApplied[0], priceRangeApplied[1], page]);

  useEffect(() => {
    fetchPacks();
    return () => { requestId.current++; };
  }, [fetchPacks]);

  // Reset to page 1 when filters change (except page)
  const handleSourceChange = (value: string) => {
    setSource(value as SourceOption);
    setPage(1);
  };
  const handleSortChange = (value: string) => {
    setSort(value as SortOption);
    setPage(1);
  };
  const handleVolatilityChange = (value: string) => {
    setVolatility(value as VolatilityOption);
    setPage(1);
  };
  const handlePriceRangeChange = (value: [number, number]) => {
    setPriceRange(value);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = page > 1;
  const canNext = hasMore || page < totalPages;

  return (
    <div className="flex flex-col items-start gap-6 w-full px-4 py-4 sm:py-5">
      <div className="flex flex-col items-start gap-4 w-full max-w-6xl mx-auto">
        <header className="mcPageHeading"><div><span>COLLECT & DISCOVER</span><h1>Cases</h1></div><p>Find your next favourite.</p></header>
        <div className={styles.categories} role="group" aria-label="Case categories">
          {CATEGORIES.map(item => <button key={item.value} type="button" aria-pressed={category===item.value} onClick={()=>{setCategory(item.value);setPage(1);}}>{item.label}</button>)}
        </div>
<div className={styles.riskFilters} role="group" aria-label="Case risk"><span>RISK</span>{(["All","Low","High"] as const).map(value=><button type="button" key={value} aria-pressed={volatility===value} onClick={()=>handleVolatilityChange(value)}>{value==="All"?"All risks":`${value} risk`}</button>)}<small>Risk describes payout variation.</small></div>
{catalogueError&&<div className={styles.catalogueError} role="alert"><span>{catalogueError}</span><button type="button" disabled={loading} onClick={()=>void fetchPacks()}>Try again</button></div>}
        <SearchBar value={search} onChange={setSearch} placeholder="Search Cases" />

        <div className="grid grid-cols-2 sm:grid-cols-2 items-center gap-2 w-full max-w-6xl sm:justify-start">
          
          <FilterButton
            icon="sort"
            label="Sort"
            defaultOption="Newest"
            options={[...SORT_OPTIONS]}
            value={sort}
            onChange={handleSortChange}
          />
          
          <PriceRangeFilter min={0} max={PRICE_MAX} onChange={handlePriceRangeChange} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 w-full">
            <span className="text-text-muted">Loading cases...</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full">
              {packs.map((pack) => (
                <div className={styles.packEntry} key={pack.id}><PackCard
                  key={pack.id}
                  id={pack.id}
                  name={pack.name}
                  price={pack.price}
                  image={pack.image}
                  isOfficial={pack.isOfficial}
                  category={pack.category}
                />{pack.risk&&<span className={styles.riskBadge} data-risk={pack.risk}>{pack.risk} risk</span>}</div>
              ))}
            </div>

            {packs.length === 0 && (
              <div className="flex items-center justify-center py-12 w-full">
                <span className="text-text-muted">No cases found. Try adjusting filters.</span>
              </div>
            )}

            {(total > 0 || page > 1) && (
              <div className="flex flex-row items-center justify-between w-full max-w-6xl pt-2">
                <span className="text-sm text-text-muted">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </span>
                <div className="flex flex-row items-center gap-2">
                  <button
                    type="button"
                    disabled={!canPrev}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(63,71,84,0.24)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[rgba(63,71,84,0.4)] transition-colors"
                    aria-label="Previous page"
                  >
                    <Icon name="chevron-right" className="w-4 h-4 rotate-180" />
                  </button>
                  <span className="text-sm font-medium text-white min-w-16 text-center">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={!canNext}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(63,71,84,0.24)] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[rgba(63,71,84,0.4)] transition-colors"
                    aria-label="Next page"
                  >
                    <Icon name="chevron-right" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
