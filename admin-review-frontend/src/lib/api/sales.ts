import { apiClient } from "./client";

function unwrap<T>(res: any): T {
  if (res?.data?.success && "data" in res.data) return res.data.data as T;
  return res?.data as T;
}

export interface SoldCartItem {
  cartItemId: string;
  title: string | null;
  imageUrl: string | null;
  value: string | null;
  currency: string;
  status: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  rewardInstanceId?: string | null;
}

export interface SaleTransaction {
  id: string;
  intentId: string;
  amount: string;
  createdAt: string;
  itemCount: number;
  items: SoldCartItem[];
  metadata?: Record<string, any> | null;
}

export interface SalesPage {
  items: SaleTransaction[];
  total: number;
  hasMore: boolean;
}

export async function getSales(params?: { limit?: number; offset?: number }): Promise<SalesPage> {
  const res = await apiClient.get(`/sales`, { params });
  return unwrap(res);
}
