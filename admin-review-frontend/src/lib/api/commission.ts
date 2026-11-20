import { apiClient } from "./client";

function unwrap<T>(res: any): T {
  if (res?.data?.success && "data" in res.data) return res.data.data as T;
  return res?.data as T;
}

export interface CommissionEarning {
  id: string;
  packId: string;
  packInstanceId: string;
  openerUserId: string;
  creatorUserId: string;
  packPrice: string;
  commissionRate: string;
  amount: string;
  status: "UNCLAIMED" | "CLAIMED";
  accruedAt: string;
  claimedAt?: string | null;
  claimIntentId?: string | null;
  pack?: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  opener?: {
    id: string;
    username: string;
    avatar: string | null;
  } | null;
}

export interface CommissionEarningsPage {
  earnings: CommissionEarning[];
  total: number;
  hasMore: boolean;
}

export async function getCommissionEarnings(params?: {
  status?: "UNCLAIMED" | "CLAIMED";
  limit?: number;
  offset?: number;
}): Promise<CommissionEarningsPage> {
  const res = await apiClient.get("/commission/earnings", { params });
  return unwrap<CommissionEarningsPage>(res);
}

export async function claimCommissionEarning(
  earningId: string
): Promise<CommissionEarning> {
  const res = await apiClient.post(`/commission/earnings/${earningId}/claim`);
  return unwrap<CommissionEarning>(res);
}
