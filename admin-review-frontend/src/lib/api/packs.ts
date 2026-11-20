import { cleanedDropImage } from "@/lib/utils/drop-cutouts";
import { apiClient } from "./client";
import { formatCurrency } from "@/lib/utils/numbers";

export type PackCategory = "All" | "Pokemon" | "CSGO" | "IRL";
function categoryOf(pack: any): Exclude<PackCategory, "All"> | undefined {
  const slug = String(pack.slug || "");
  return slug.startsWith("pokemon-") ? "Pokemon" : slug.startsWith("csgo-") ? "CSGO" : slug.startsWith("irl-") ? "IRL" : undefined;
}

export interface Pack {
  id: string;
  name: string;
  price: string;
  itemCount: number;
  category?: Exclude<PackCategory, "All">;
  openPrice?: string;
  image: string;
  stockCount?: number | null;
  /** True = Official (admin-created), false = Community (user-created) */
  isOfficial?: boolean;
}

export interface Template {
  imageUrl: string;
  name: string;
  value: string;
  description: string;
}

export interface PackItem {
  id: string;
  image: string;
  name: string;
  price: string;
  probability: string;
  description?: string;
  startTicket?: number;
  endTicket?: number;
  metadata: { probability: number; normalizedWeight: number };
  template?: Template;
  rarity?: string;
  weight?: number;
}

export interface PackDetails extends Pack {
  id: string;
  name: string;
  price: string;
  itemCount: number;
  image: string;
  items: PackItem[];
  template?: Template;
  stockCount?: number | null;
}

export interface GetPacksFilters {
  category?: PackCategory;
  search?: string;
  source?: "Official" | "Community" | "All";
  sort?: "Newest" | "Oldest" | "Price: Low to High" | "Price: High to Low" | "Name: A-Z" | "Name: Z-A";
  volatility?: "Low" | "Medium" | "High" | "All";
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export interface GetPacksResponse {
  packs: Pack[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Safely turns 0.25, "0.25" or "$0.25" into the number 0.25 */
const toNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[^0-9.]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Makes image paths from the old backend loadable by the frontend.
 * Full web addresses stay as they are. Paths starting with "/" are sent
 * through the existing /api/v1 rewrite so they load from the backend.
 */
const resolveImage = (src: unknown, fallback: string): string => {
  const value = cleanedDropImage(src);
  if (!value) return fallback;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/api/v1/")) return value;
  return `/api/v1${value.startsWith("/") ? "" : "/"}${value}`;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Turns a backend error like { error: "INSUFFICIENT_BALANCE" } into a readable message */
function getErrorMessage(error: any, fallback: string): string {
  const code = error?.response?.data?.error;
  if (code === "INSUFFICIENT_BALANCE") return "Insufficient balance";
  if (code === "SLOW_DOWN") return "Please slow down and try again";
  if (code === "DISABLED") return "Case opening is currently disabled";
  if (code === "UNAUTHORIZED" || error?.response?.status === 401) return "Please log in first";
  return code || error?.response?.data?.message || error?.message || fallback;
}

function mapBackendPackToPackDetails(pack: any): PackDetails {
  const items: PackItem[] = (pack.packRewards || []).map((reward: any) => {
    const template = reward.template ?? {};
    const valueStr = template.value?.toString?.() ?? reward.value?.toString?.() ?? "0";
    const valueNum = Number.parseFloat(valueStr);

    return {
      id: reward.id,
      image: template.imageUrl || reward.imageUrl || "",
      name: template.name || reward.name || "",
      price: Number.isFinite(valueNum) ? `$${formatCurrency(valueNum)}` : "$0.00",
      probability: "",
      description: template.description || reward.description || "",
      startTicket: reward.startTicket ?? undefined,
      endTicket: reward.endTicket ?? undefined,
      metadata: {
        probability: reward.metadata?.probability ?? 0,
        normalizedWeight: reward.metadata?.normalizedWeight ?? 0,
      },
      template: {
        imageUrl: template.imageUrl || "",
        name: template.name || "",
        value: valueStr,
        description: template.description || "",
      },
      rarity: reward.rarity,
      weight: reward.weight,
    };
  });

  return {
    id: pack.id,
    name: pack.name,
    price: `$${formatCurrency(pack?.price ?? "0")}`,
    openPrice: pack.price,
    image: pack.imageUrl || "/assets/images/pack1.webp",
    itemCount: items.length,
    items,
    stockCount: pack.stockCount ?? null,
  };
}

export interface DrawerSlot {
  slotIndex: number;
  packInstanceId: string;
  serverSeedHash: string;
  pack: PackDetails;
}

export interface DrawerInitOrSyncResponse {
  drawerSessionId: string;
  instances: DrawerSlot[];
}

export interface DrawerOpenResult {
  slotIndex: number;
  packInstanceId: string;
  packId: string;
  serverSeedHash: string;
  selectedPackRewardId: string;
  ticketNumber: number;
  reward: {
    id: string;
    name: string;
    type: string;
    value: string;
    rarity: string;
    imageUrl: string | null;
    description: string | null;
  };
}

export interface DrawerOpenResponse {
  drawerSessionId: string;
  openedAt: string;
  results: DrawerOpenResult[];
  nextRound?: DrawerInitOrSyncResponse;
}

export interface PackHistoryItem {
  id: string;
  packId: string;
  packName: string | null;
  packImageUrl: string | null;
  packPrice: string | null;
  openedAt: string | null;
  purchasedAt: string | null;
}

export interface PackHistoryPage {
  items: PackHistoryItem[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

function unwrap<T>(res: any): T {
  if (res?.data?.success && "data" in res.data) return res.data.data as T;
  return res?.data as T;
}

/**
 * Get user's opened pack history.
 * The old backend has no /packs/history route, so we return an empty list
 * instead of crashing.
 */
export async function getPackHistory(params?: {
  limit?: number;
  offset?: number;
}): Promise<PackHistoryPage> {
  const empty: PackHistoryPage = {
    items: [],
    total: 0,
    hasMore: false,
    limit: params?.limit ?? 10,
    offset: params?.offset ?? 0,
  };
  try {
    const res = await apiClient.get("/packs/history", { params });
    const data = unwrap<PackHistoryPage>(res);
    return data ?? empty;
  } catch {
    return empty;
  }
}

/**
 * Get packs with filters.
 * The old backend GET /cases returns the full list and ignores filters,
 * so search, sort, price range and paging are done here.
 * (Source and Volatility have no data in the old backend, so they are ignored.)
 */
export async function getPacks(filters?: GetPacksFilters, options?: { throwOnError?: boolean }): Promise<GetPacksResponse> {
  const limit = filters?.limit ?? 24;
  const page = filters?.page ?? 1;
  const offset = (page - 1) * limit;

  try {
    const list = await fetchCasesList();

    let rows = list.map((pack: any) => ({
      pack,
      priceNum: toNumber(pack.price),
      time: pack.modifiedAt ? new Date(pack.modifiedAt).getTime() || 0 : 0,
      nameLower: String(pack.name ?? "").toLowerCase(),
    }));

    if (filters?.category && filters.category !== "All") rows = rows.filter(row => categoryOf(row.pack) === filters.category);

    const search = filters?.search?.trim().toLowerCase();
    if (search) rows = rows.filter((r) => r.nameLower.includes(search));
    if (filters?.minPrice != null && Number.isFinite(filters.minPrice)) {
      rows = rows.filter((r) => r.priceNum >= (filters.minPrice as number));
    }
    if (filters?.maxPrice != null && Number.isFinite(filters.maxPrice)) {
      rows = rows.filter((r) => r.priceNum <= (filters.maxPrice as number));
    }

    switch (filters?.sort) {
      case "Oldest":
        rows.sort((a, b) => a.time - b.time);
        break;
      case "Price: Low to High":
        rows.sort((a, b) => a.priceNum - b.priceNum);
        break;
      case "Price: High to Low":
        rows.sort((a, b) => b.priceNum - a.priceNum);
        break;
      case "Name: A-Z":
        rows.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
        break;
      case "Name: Z-A":
        rows.sort((a, b) => b.nameLower.localeCompare(a.nameLower));
        break;
      default: // "Newest"
        rows.sort((a, b) => b.time - a.time);
    }

    const total = rows.length;
    const packs: Pack[] = rows.slice(offset, offset + limit).map(({ pack }) => ({
      id: String(pack.id),
      name: pack.name,
      price: `$${formatCurrency(pack.price ?? "0")}`,
      image: resolveImage(pack.img || pack.imageUrl, "/assets/images/pack1.webp"),
      itemCount: 0,
      category: categoryOf(pack),
      openPrice: pack.price,
      stockCount: pack.stockCount ?? null,
      isOfficial: !!categoryOf(pack) || (pack.creator?.isAdmin ?? false),
    }));

    return { packs, total, hasMore: offset + limit < total, limit, offset };
  } catch (error: unknown) {
    if (options?.throwOnError) throw error;
    console.warn("Error fetching packs:", error);
    return { packs: [], total: 0, hasMore: false, limit, offset };
  }
}

// ---------------------------------------------------------------------------
// Pack details (old backend: GET /cases, then GET /cases/:slug)
// ---------------------------------------------------------------------------

let casesListCache: { at: number; list: any[] } | null = null;

async function fetchCasesList(): Promise<any[]> {
  if (casesListCache && Date.now() - casesListCache.at < 30000) return casesListCache.list;

  const res = await apiClient.get("/cases");
  const raw = res?.data?.data ?? res?.data;
  const list: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.cases)
    ? raw.cases
    : Array.isArray(raw?.packs)
    ? raw.packs
    : [];

  casesListCache = { at: Date.now(), list };
  return list;
}

/** Finds a case by id (or slug) and loads its items */
async function fetchCaseById(packId: string): Promise<{ match: any; caseData: any }> {
  const list = await fetchCasesList();
  const match = list.find(
    (c: any) => String(c.id) === String(packId) || String(c.slug) === String(packId)
  );
  if (!match || !match.slug) throw new Error(`Pack not found (id: ${packId})`);

  const detailRes = await apiClient.get(`/cases/${encodeURIComponent(String(match.slug))}`);
  const caseData = detailRes?.data?.data ?? detailRes?.data ?? {};
  return { match, caseData };
}

/** One backend item -> the item shape the frontend expects */
function mapCaseItem(item: any): PackItem & { value: number; imageUrl: string } {
  const price = toNumber(item.price ?? item.value);
  const image = resolveImage(item.img || item.imageUrl, "/img/logo.png");
  const name = item.name || item.itemName || "Unknown Item";
  // backend probability is a percent (12.5 = 12.5%), frontend wants a fraction
  const first = Number(item.startTicket ?? item.rangeFrom);
  const last = Number(item.endTicket ?? item.rangeTo);
  const validRange = Number.isInteger(first) && Number.isInteger(last)
    && first >= 1 && last >= first && last <= 100000;
  const chance = validRange
    ? (last - first + 1) / 100000
    : toNumber(item.probability) / 100;

  return {
    id: String(item.id),
    name,
    image,
    price: `$${formatCurrency(price)}`,
    probability: `${(chance * 100).toFixed(3)}%`,
    startTicket: validRange ? first : undefined,
    endTicket: validRange ? last : undefined,
    description: "",
    metadata: { probability: chance, normalizedWeight: chance },
    template: { imageUrl: image, name, value: String(price), description: "" },
    // extra fields used by the pack page / spin
    value: price,
    imageUrl: image,
  };
}

function caseToPackDetails(match: any, caseData: any): PackDetails {
  const rawItems: any[] = Array.isArray(caseData.items)
    ? caseData.items
    : Array.isArray(caseData.caseItems)
    ? caseData.caseItems
    : [];
  const items = rawItems.map(mapCaseItem);
  const priceNum = toNumber(caseData.price ?? match.price);

  return {
    id: String(caseData.id ?? match.id),
    name: caseData.name ?? match.name,
    price: `$${formatCurrency(priceNum)}`,
    openPrice: String(priceNum),
    image: resolveImage(caseData.img || match.img, "/assets/images/pack1.webp"),
    itemCount: items.length,
    items,
    stockCount: null,
  };
}

/**
 * Get pack details by ID.
 * Old backend has no /cases/:id, so we:
 *  1) GET /cases to find the case with this id
 *  2) GET /cases/:slug to get its items
 */
export async function getPackDetails(packId: string): Promise<any> {
  try {
    const { match, caseData } = await fetchCaseById(packId);
    const details = caseToPackDetails(match, caseData);

    return {
      success: true,
      data: {
        ...details,
        price: details.price,
        imageUrl: details.image,
      },
    };
  } catch (error) {
    console.error("Failed to load pack details:", error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Drawer (the old backend has no drawer sessions, so we build them locally
// and open cases with POST /cases/:id/open)
// ---------------------------------------------------------------------------

async function buildInstances(drawerSessionId: string, packs: string[]): Promise<DrawerSlot[]> {
  const cache: Record<string, PackDetails> = {};
  const instances: DrawerSlot[] = [];

  for (let i = 0; i < packs.length; i++) {
    const id = String(packs[i]);
    if (!cache[id]) {
      const { match, caseData } = await fetchCaseById(id);
      cache[id] = caseToPackDetails(match, caseData);
    }
    instances.push({
      slotIndex: i,
      packInstanceId: `${drawerSessionId}-${i}`,
      serverSeedHash: "",
      pack: cache[id],
    });
  }

  return instances;
}

export async function drawerInit(
  drawerSessionId: string,
  packs: string[]
): Promise<DrawerInitOrSyncResponse> {
  return { drawerSessionId, instances: await buildInstances(drawerSessionId, packs) };
}

export async function drawerSync(
  drawerSessionId: string,
  packs: string[]
): Promise<DrawerInitOrSyncResponse> {
  return { drawerSessionId, instances: await buildInstances(drawerSessionId, packs) };
}

export async function drawerCancel(_drawerSessionId: string): Promise<void> {
  // Nothing to cancel: the old backend has no drawer sessions.
}

export async function drawerOpen(
  drawerSessionId: string,
  _intentId: string,
  packs: string[],
  _clientSeed?: string
): Promise<DrawerOpenResponse> {
  const ids = packs.map((p) => String(p));

  // Group slots by pack id (one backend call can open up to 5 of the same case)
  const slotsByPack = new Map<string, number[]>();
  ids.forEach((id, slot) => {
    slotsByPack.set(id, [...(slotsByPack.get(id) ?? []), slot]);
  });

  const results: (DrawerOpenResult | undefined)[] = new Array(ids.length).fill(undefined);
  let firstCall = true;

  for (const [id, slots] of slotsByPack) {
    for (let start = 0; start < slots.length; start += 5) {
      const chunk = slots.slice(start, start + 5);

      // Backend rate limit: 1 request per 300ms for the same case
      if (!firstCall) await sleep(350);
      firstCall = false;

      let data: any;
      try {
        const res = await apiClient.post(`/cases/${encodeURIComponent(id)}/open`, {
          amount: chunk.length,
        });
        data = res?.data?.data ?? res?.data;
      } catch (error: any) {
        throw new Error(getErrorMessage(error, "Failed to open pack"));
      }

      const rawResults: any[] = Array.isArray(data?.results) ? data.results : [];
      if (rawResults.length < chunk.length) {
        throw new Error(getErrorMessage({ response: { data } }, "Failed to open pack"));
      }

      chunk.forEach((slot, k) => {
        const r = rawResults[k];
        const item = r?.item ?? {};
        results[slot] = {
          slotIndex: slot,
          packInstanceId: `${drawerSessionId}-${slot}`,
          packId: id,
          serverSeedHash: "",
          selectedPackRewardId: String(item.id ?? ""),
          ticketNumber: Number(r?.result) || 0,
          reward: {
            id: String(item.id ?? ""),
            name: item.name ?? "Item",
            type: "ITEM", // won items go to the cart (inventory); the page shows the "open the Cart" message
            value: String(toNumber(item.price)),
            rarity: "COMMON",
            imageUrl: resolveImage(item.img || item.imageUrl, "") || null,
            description: null,
          },
        };
      });
    }
  }

  return {
    drawerSessionId,
    openedAt: new Date().toISOString(),
    results: results.filter((r): r is DrawerOpenResult => Boolean(r)),
    nextRound: undefined,
  };
}
