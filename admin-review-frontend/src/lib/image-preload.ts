/**
 * Preload pack item images so they are in the browser cache before the slot machine
 * or result UI displays them. Call when round results are known (e.g. onBattleRoundResolved).
 */
export type PreloadableItem = { image?: string; template?: { imageUrl?: string } };

const preloaded = new Set<string>();

export function preloadPackItemImages(items: PreloadableItem[]): void {
  if (typeof window === "undefined") return;
  items.forEach((item) => {
    const url = item?.template?.imageUrl || item?.image;
    if (!url || preloaded.has(url)) return;
    preloaded.add(url);
    const img = new window.Image();
    img.src = url;
  });
}
