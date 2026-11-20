import { type Battle, getBattles } from "./battles";

/**
 * Newest battles for the homepage highlights.
 * The old backend has no HTTP route for this, so we use the same
 * socket list as the Battles lobby and keep the newest ones.
 */
export async function getLiveBattles(limit = 3): Promise<Battle[]> {
  try {
    const safe = Math.min(10, Math.max(1, Math.floor(limit)));
    const all = await getBattles({ limit: 50 }); // already newest first
    return all.slice(0, safe);
  } catch (error: any) {
    console.warn("Live battles are unavailable:", error);
    return [];
  }
}
