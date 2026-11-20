import { apiClient } from "./client";

export interface AdminProfile { id: string; username: string; role: "ADMIN" | "OWNER" | "DEV" }
export interface AdminDashboard { day: number; week: number; month: number; total: number }

function rejectError(data: any): void {
  if (data?.error) throw new Error(String(data.error));
}

export async function getAdminProfile(token: string): Promise<AdminProfile> {
  const response = await apiClient.get("/user", { headers: { Authorization: token } });
  rejectError(response.data);
  const profile = response.data;
  if (!profile || !["ADMIN", "OWNER", "DEV"].includes(profile.role)) {
    throw new Error("ADMIN_ONLY");
  }
  if (profile.id == null) throw new Error("INVALID_ADMIN_PROFILE");
  return { id: String(profile.id), username: String(profile.username || "Administrator"), role: profile.role };
}

export async function getAdminDashboard(token: string): Promise<AdminDashboard> {
  const response = await apiClient.get("/admin/dashboard", { headers: { Authorization: token } });
  rejectError(response.data);
  const profit = response.data?.profit;
  const values = [profit?.lastDay, profit?.last7d, profit?.last31d, profit?.total];
  if (values.some((value) => value == null || value === "" || !Number.isFinite(Number(value)))) {
    throw new Error("INVALID_DASHBOARD");
  }
  return { day: Number(values[0]), week: Number(values[1]), month: Number(values[2]), total: Number(values[3]) };
}

export function adminError(error: unknown): string {
  const e = error as { response?: { status?: number; data?: { error?: string; errors?: string } }; message?: string };
  const code = e.response?.data?.error || e.response?.data?.errors || e.message;
  if (code === "WAGER_REQUIREMENT_NOT_MET") return "This player must complete their wagering requirement before the withdrawal can be approved.";
  if (code === "ADMIN_ONLY" || code === "UNAUTHORIZED" || code === "FORBIDDEN" || e.response?.status === 403) return "This page is available to ADMIN, OWNER, and DEV accounts only.";
  if (code === "2FA_REQUIRED") return "The backend requires admin verification before it will return these statistics.";
  if (e.response?.status === 401) return "Please log in again to continue.";
  if (code === "INVALID_DASHBOARD") return "The dashboard response could not be read. No statistics are shown.";
  if (e.response?.status === 404) return "This admin endpoint was not found (404).";
  if (e.response?.status === 429) return "Too many requests. Wait before trying again.";
  if (code && /^[A-Z][A-Z0-9_]+$/.test(code)) return code.replaceAll("_", " ");
  return "The request failed. Refresh to check the current server state before retrying.";
}

export type AdminUser = {
  id: string | number; username: string; role: string; balance: number; xp: number;
  wagered?: number; deposits?: number; withdraws?: number;
  banned?: boolean | number; rainBan?: boolean | number; tipBan?: boolean | number;
  leaderboardBan?: boolean | number; accountLock?: boolean | number; sponsorLock?: boolean | number;
  muteSeconds?: number | null; maxPerTip?: number | null; maxTipPerUser?: number | null;
  tipAllowance?: number | null; rainTipAllowance?: number | null; cryptoAllowance?: number | null;
};
export type UserPage = { data: AdminUser[]; page: number; pages: number; total: number };
export type UserChanges = Partial<Pick<AdminUser, "role" | "balance" | "xp" | "muteSeconds" | "maxPerTip" | "maxTipPerUser" | "tipAllowance" | "rainTipAllowance" | "cryptoAllowance">> & Partial<Record<"banned" | "rainBan" | "tipBan" | "leaderboardBan" | "accountLock" | "sponsorLock", boolean>>;
export type CashierTransaction = { wageringRemaining?:string|number; bonusCode?:string|null;bonusStatus?:string|null;bonusAmount?:string|number|null;wagerAmount?:string|number|null; id: number; userId: number; username: string; type: "crypto_deposit" | "crypto_withdraw"; amount: number; coin: string; txHash: string | null; createdAt: string; status: string };
const auth = (token: string) => ({ headers: { Authorization: token } });
async function readAdmin<T>(path: string, token: string, params?: object): Promise<T> {
  const { data } = await apiClient.get(path, { ...auth(token), params });
  rejectError(data); return data as T;
}
async function writeAdmin(path: string, token: string, body: object): Promise<void> {
  const { data } = await apiClient.post(path, body, auth(token));
  rejectError(data);
  if (data?.errors) throw new Error(String(data.errors));
  if (data?.success !== true) throw new Error("UPDATE_NOT_CONFIRMED");
}
export async function getAdminUsers(token: string, page: number, search: string, sortBy: string, sortOrder: string) {
  const data = await readAdmin<UserPage>("/admin/users", token, { page, search, sortBy, sortOrder });
  if (!Array.isArray(data?.data)) throw new Error("INVALID_USERS_RESPONSE");
  return data;
}
export const getAdminUser = (token: string, id: string | number) => readAdmin<AdminUser>(`/admin/users/${encodeURIComponent(id)}`, token);
export const updateAdminUser = (token: string, id: string | number, changes: UserChanges) => writeAdmin(`/admin/users/${encodeURIComponent(id)}`, token, changes);
export async function getPendingTransactions(token: string) {
  const data = await readAdmin<{data: CashierTransaction[]}>("/admin/cashier/pending", token);
  if (!Array.isArray(data?.data)) throw new Error("INVALID_CASHIER_RESPONSE");
  return data.data;
}
export const processTransaction = (token: string, action: "approve-deposit" | "approve-withdraw" | "reject", transactionId: number, txHash?: string) => writeAdmin(`/admin/cashier/${action}`, token, { transactionId, ...(txHash?.trim() ? { txHash: txHash.trim() } : {}) });
