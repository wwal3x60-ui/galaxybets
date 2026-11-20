import { apiClient } from "./client";

function unwrap<T>(res: any): T {
  if (res?.data?.success && "data" in res.data) return res.data.data as T;
  return res?.data as T;
}

export interface WalletBalanceResponse {
  accountId: string;
  balance: string; // decimal string
  currency?: string;
}

/**
 * Old backend has no /wallet/balance, so we read the balance
 * from the user profile (GET /user). If anything fails we return 0
 * instead of crashing the page.
 */
export async function getWalletBalance(): Promise<WalletBalanceResponse> {
  try {
    const res = await apiClient.get("/user");
    const raw = unwrap<any>(res);
    const u = raw?.user ?? raw ?? {};
    const rawBalance = u.balance ?? 0;
    const num = Number(rawBalance);
    return {
      accountId: String(u.id ?? ""),
      balance: String(Number.isFinite(num) ? num : 0),
      currency: "USD",
    };
  } catch (error) {
    console.warn("Could not load wallet balance:", error);
    return { accountId: "", balance: "0", currency: "USD" };
  }
}
