import type { PackItem } from "@/lib/api/packs";

export function itemForTicket(items: PackItem[], ticket: number): PackItem | null {
  if (!Number.isInteger(ticket) || ticket < 1 || ticket > 100000) return null;
  const sorted = [...items].sort((a, b) => Number(a.startTicket) - Number(b.startTicket));
  let next = 1;
  for (const item of sorted) {
    const start = Number(item.startTicket), end = Number(item.endTicket);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start !== next || end < start || end > 100000) return null;
    next = end + 1;
  }
  if (next !== 100001) return null;
  return sorted.find(item => ticket >= Number(item.startTicket) && ticket <= Number(item.endTicket)) ?? null;
}

export function sampleDemoDrop(items: PackItem[]): PackItem | null {
  if (!items.length) return null;
  let ticket: number;
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / 100000) * 100000;
    do { globalThis.crypto.getRandomValues(values); } while (values[0] >= limit);
    ticket = values[0] % 100000 + 1;
  } else {
    ticket = Math.floor(Math.random() * 100000) + 1;
  }
  const exact = itemForTicket(items, ticket);
  if (exact) return exact;
  // Legacy packs may only expose fractional weights, without ticket intervals.
  const weights = items.map(item => Number(item.metadata?.probability));
  if (weights.some(value => !Number.isFinite(value) || value < 0)) return null;
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return null;
  const target = ((ticket - 1) / 100000) * total;
  let cumulative = 0;
  for (let index = 0; index < items.length; index++) {
    cumulative += weights[index];
    if (target < cumulative) return items[index];
  }
  return items.at(-1) ?? null;
}
