export interface NavItem {
  label: string;
  href: string;
  icon?: string; // Icon name for future icon implementation
  external?: boolean;
}

export const navigationItems: NavItem[] = [
  { label: "Cases", href: "/cases", icon: "cards" },
  { label: "Battles", href: "/battles", icon: "adventure" },
  { label: "Events", href: "/events", icon: "party" },
  { label: "Affiliates", href: "/affiliates", icon: "gift" },
];

export type GameKind = "roulette" | "mines" | "coinflip" | "jackpot" | "keno";
export interface GameNavItem {
  label: string;
  href: string;
  kind: GameKind;
}
export const gameItems: GameNavItem[] = [
  { label: "Keno", href: "/keno", kind: "keno" },
  { label: "Roulette", href: "/roulette", kind: "roulette" },
  { label: "Mines", href: "/mines", kind: "mines" },
  { label: "Coinflip", href: "/coinflip", kind: "coinflip" },
  { label: "Jackpot", href: "/jackpot", kind: "jackpot" },
];
