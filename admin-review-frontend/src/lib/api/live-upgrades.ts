import { apiClient } from "./client";
import type { UpgradeHighlightItem } from "@/lib/websocket";

export async function getLiveUpgrades(limit = 5): Promise<UpgradeHighlightItem[]> {
  try {
    const safe = Math.min(20, Math.max(1, Math.floor(limit)));
    const res = await apiClient.get<{ success: boolean; data: UpgradeHighlightItem[] }>(`/live-upgrades?limit=${safe}`);
    if (!res.data?.success || !Array.isArray(res.data.data)) {
      throw new Error("Invalid live-upgrades response");
    }
    return res.data.data;
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) {
      return [];
    }
    console.warn("Live upgrades are unavailable:", error);
    return [];
  }
}
