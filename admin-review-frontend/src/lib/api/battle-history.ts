import { apiClient } from "./client";
import { type Battle, type BattlesPage, getBattleById } from "./battles";
import { useAuthStore } from "@/store/auth.store";

/**
 * Battle history of the logged-in user.
 * Old backend: GET /user/bets?games=battle&page=N (10 per page) lists the
 * battles you played; each one is then loaded with its full details.
 */
export async function getBattleHistory(params?: {
  limit?: number;
  offset?: number;
}): Promise<BattlesPage> {
  const limit = params?.limit ?? 10;
  const offset = params?.offset ?? 0;
  const empty: BattlesPage = { battles: [], total: 0, hasMore: false, limit, offset };

  if (!useAuthStore.getState().token) return empty;

  try {
    const page = Math.floor(offset / 10) + 1; // the backend always uses pages of 10
    const res = await apiClient.get("/user/bets", { params: { games: "battle", page } });
    const data = res?.data ?? {};
    const rows: any[] = Array.isArray(data.data) ? data.data : [];
    const total = Number(data.total) || 0;

    const loaded = await Promise.all(rows.map((r) => getBattleById(String(r.gameId))));
    const battles = loaded.filter((b): b is Battle => b !== null);

    return { battles, total, hasMore: offset + rows.length < total, limit, offset };
  } catch (error: any) {
    // 404 PAGE_NOT_FOUND just means "no more pages"
    if (error?.response?.status !== 404) console.warn("Could not load battle history:", error);
    return empty;
  }
}
