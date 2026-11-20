import type { ReactNode } from "react";

// One 24px grid, rounded terminals and consistent optical weight across the UI.
const shapes: Record<string, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h5v-6h4v6h5V9"/></>,
  packs: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/></>,
  battles: <><path d="m4 3 7 7-3 3-6-7 2-3Zm16 0-7 7 3 3 6-7-2-3ZM4 20l5-5m11 5-5-5M3 16l5 5m8 0 5-5"/></>,
  games: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  slots: <><rect x="3" y="6" width="17" height="14" rx="3"/><path d="M8 10v5m4-5v5m4-5v5M20 10h2V5M7 3h9"/><circle cx="22" cy="3" r="1"/></>,
  mines: <><path d="m7 4-4 6 9 11 9-11-4-6H7ZM3 10h18M7 4l5 17 5-17M7 4l5 6 5-6"/></>,
  roulette: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6M3 12h6m6 0h6M6 6l4 4m4 4 4 4m0-12-4 4m-4 4-4 4"/></>,
  jackpot: <><path d="m3 6 4 5 5-8 5 8 4-5-3 14H6L3 6Z"/><path d="M7 16h10"/></>,
  coinflip: <><circle cx="10" cy="12" r="8"/><path d="M14 4h1a8 8 0 0 1 0 16h-1M12 8H9a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H8m2-10v12"/></>,
  account: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
  people: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m3 4a6 6 0 0 1 3 5"/></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13m0-13H8a2.5 2.5 0 1 1 2.5-2.5L12 8Zm0 0h4a2.5 2.5 0 1 0-2.5-2.5L12 8Z"/></>,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
  support: <><path d="M4 13v-1a8 8 0 0 1 16 0v1M20 18v1a3 3 0 0 1-3 3h-4"/><rect x="2" y="12" width="4" height="7" rx="2"/><rect x="18" y="12" width="4" height="7" rx="2"/></>,
  search: <><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  cart: <><path d="M3 3h3l3 12h10l3-9H7"/><circle cx="10" cy="20" r="1"/><circle cx="19" cy="20" r="1"/></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="3"/><path d="m5 6 11-3v3M21 11h-5v5h5M17 13.5h.01"/></>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  "arrow-left": <path d="M20 12H4m6-6-6 6 6 6"/>,
  "arrow-down-left": <path d="M18 6 6 18M6 8v10h10"/>,
  "chevron-down": <path d="m6 9 6 6 6-6"/>,
  "chevron-right": <path d="m9 6 6 6-6 6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  minus: <path d="M5 12h14"/>,
  x: <path d="m6 6 12 12M18 6 6 18"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  refresh: <><path d="M20 10a8 8 0 1 0-2 8M20 3v7h-7"/></>,
  history: <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
  copy: <><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,
  filter: <><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="var(--background-elevated, #191a1e)"/><circle cx="15" cy="12" r="2" fill="var(--background-elevated, #191a1e)"/><circle cx="9" cy="18" r="2" fill="var(--background-elevated, #191a1e)"/></>,
  sort: <><path d="M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4"/></>,
  dice: <><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01" strokeWidth="3"/></>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  logout: <><path d="M10 3H4v18h6M10 12h12m-4-4 4 4-4 4"/></>,
  chart: <><path d="M3 3v18h18M7 16v-4m5 4V8m5 8V5"/></>,
  trophy: <><path d="M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4M12 13v8m-5 0h10"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/></>,
  zap: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>,
};
const aliases: Record<string, string> = {
  user: "account", dashboard: "games", apps: "games", "grid-view": "games",
  "security-check": "shield", "chat-question": "support", "user-group": "people",
  "logout-05": "logout", arrange: "filter", "filter-horizontal": "filter", sorting: "sort",
  "dice-faces": "dice", "dice-faces-05": "dice", "information-circle": "info",
  "help-circle": "info", danger: "info", award: "trophy", medal: "trophy", champion: "trophy",
  adventure: "battles", cards: "packs", coin: "coinflip", keno: "games",
};
export function hasUiGlyph(name: string) { return Boolean(shapes[aliases[name] || name]); }
export default function UiGlyph({ name, size = 20, className }: { name: string; size?: number | string; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[aliases[name] || name] || shapes.games}</svg>;
}
