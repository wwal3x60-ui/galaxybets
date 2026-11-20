import { apiClient } from "./client";

export interface UpgraderItem {
  id: string;
  image: string;
  name: string;
  description?: string | null;
  price: string;
}

export interface UpgraderFilters {
  search?: string;
  sort?: "Price - Low to high" | "Price - High to low";
  priceRange?: string;
  limit?: number;
  offset?: number;
}

export interface UpgraderSpinResult {
  intentId: string;
  productId: string;
  outcomePct: number;
  productPrice: string;
  spinPrice: string;
  roll: number;
  won: boolean;
  ticketNumber: number;
  serverSeedHash: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  combinedHash: string;
  cartItem: any | null;
  alreadyProcessed: boolean;
}

export interface UpgraderProvablyFairSeed {
  commitId: string;
  serverSeedHash: string;
  nonce: number;
}

export interface UpgraderDemoSpinResult {
  productId: string;
  outcomePct: number;
  productPrice: string;
  spinPrice: string;
  roll: number;
  won: boolean;
  ticketNumber: number;
  serverSeedHash: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  combinedHash: string;
}

export interface UpgraderHistoryItem {
  id: string;
  createdAt: string;
  intentId?: string | null;
  productId: string;
  productName?: string | null;
  productPrice?: string | null;
  spinPrice?: string | null;
  outcomePct?: number | null;
  won: boolean;
  roll?: number | null;
  image?: string | null;
}

export interface UpgraderHistoryPage {
  items: UpgraderHistoryItem[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

/**
 * Get items available for upgrading
 */
export async function getUpgraderItems(filters?: UpgraderFilters): Promise<UpgraderItem[]> {
  try {
    const res = await apiClient.get<{
      success: boolean;
      data: { items: UpgraderItem[]; total: number; hasMore: boolean; limit: number; offset: number };
    }>("/upgrader/items", { params: filters });

    if (!res.data?.success) return [];
    return res.data.data.items;
  } catch (error: unknown) {
    console.error("Error fetching upgrader items:", error);
    return [];
  }
}

export async function getUpgraderItemsPage(filters?: UpgraderFilters): Promise<{
  items: UpgraderItem[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}> {
  const res = await apiClient.get<{
    success: boolean;
    data: { items: UpgraderItem[]; total: number; hasMore: boolean; limit: number; offset: number };
  }>("/upgrader/items", { params: filters });
  if (!res.data?.success) {
    return { items: [], total: 0, hasMore: false, limit: filters?.limit ?? 0, offset: filters?.offset ?? 0 };
  }
  return res.data.data;
}

export async function getUpgraderProvablyFairSeed(): Promise<UpgraderProvablyFairSeed> {
  const res = await apiClient.get<{ success: boolean; data: UpgraderProvablyFairSeed }>(
    "/upgrader/provably-fair/seed"
  );
  if (!res.data?.success) {
    throw new Error("Failed to get upgrader provably-fair seed");
  }
  return res.data.data;
}

const MAX_TICKET = 1_000_000;

/** Convert circle start angle (0–360°) to ticket 1..1_000_000 (same mapping as wheel). */
export function startTicketFromAngle(startAngleDeg: number): number {
  const a = ((Number(startAngleDeg) % 360) + 360) % 360;
  const t = 1 + Math.floor((a / 360) * MAX_TICKET);
  return Math.max(1, Math.min(MAX_TICKET, t));
}

export async function spinUpgrader(input: {
  intentId: string;
  productId: string;
  outcomePct: number;
  /** Start of win range (1..1_000_000). Default 1 if omitted. */
  startTicket?: number;
  commitId: string;
}): Promise<UpgraderSpinResult> {
  const res = await apiClient.post<{ success: boolean; data: UpgraderSpinResult }>(
    "/upgrader/spin",
    input
  );
  if (!res.data?.success) {
    throw new Error("Upgrader spin failed");
  }
  return res.data.data;
}

export async function demoSpinUpgrader(input: {
  productId: string;
  outcomePct: number;
  /** Start of win range (1..1_000_000). Default 1 if omitted. */
  startTicket?: number;
  commitId: string;
}): Promise<UpgraderDemoSpinResult> {
  const res = await apiClient.post<{ success: boolean; data: UpgraderDemoSpinResult }>(
    "/upgrader/demo-spin",
    input
  );
  if (!res.data?.success) {
    throw new Error("Upgrader demo spin failed");
  }
  return res.data.data;
}

export async function getUpgraderHistory(params?: {
  limit?: number;
  offset?: number;
}): Promise<UpgraderHistoryPage> {
  const res = await apiClient.get<{ success: boolean; data: UpgraderHistoryPage }>(
    "/upgrader/history",
    { params }
  );
  if (!res.data?.success) {
    return {
      items: [],
      total: 0,
      hasMore: false,
      limit: params?.limit ?? 0,
      offset: params?.offset ?? 0,
    };
  }
  return res.data.data;
}
