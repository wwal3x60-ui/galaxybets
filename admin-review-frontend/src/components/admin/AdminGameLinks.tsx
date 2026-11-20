import Link from "next/link";

const games = [
  { label: "Mines", href: "/mines" },
  { label: "Battles", href: "/battles" },
  { label: "Cases", href: "/cases" },
  { label: "Jackpot", href: "/jackpot" },
  { label: "Coinflip", href: "/coinflip" },
  { label: "Roulette", href: "/roulette" },
];

export default function AdminGameLinks() {
  return (
    <nav
      aria-label="Admin game shortcuts"
      className="mb-6 rounded-2xl border border-border-subtle bg-background-elevated p-4"
    >
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        Open a game
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {games.map((game) => (
          <Link
            key={game.href}
            href={game.href}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border-subtle bg-surface-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-ancient-purple hover:bg-button-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ancient-purple focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {game.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
