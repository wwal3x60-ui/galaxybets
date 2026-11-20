"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UiGlyph from "@/components/ui/UiGlyph";
import styles from "./FeaturedSlotsSection.module.css";

type FeaturedSlot = { id: string; name: string; provider: string; image: string };

function SlotCard({ game }: { game: FeaturedSlot }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [game.image]);
  return <Link className={styles.card} href={`/slots/play?game=${encodeURIComponent(game.id)}`} aria-label={`Open ${game.name} by ${game.provider}`}>
    <div className={styles.art}>
      {failed ? <span className={styles.fallback}><UiGlyph name="slots" size={38}/><small>{game.name}</small></span> :
        <img src={game.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}/>}
      <span className={styles.open}><UiGlyph name="arrow" size={22}/><span>View game</span></span>
    </div>
    <h3 title={game.name}>{game.name}</h3><p title={game.provider}>{game.provider}</p>
  </Link>;
}

export default function FeaturedSlotsSection() {
  const [games, setGames] = useState<FeaturedSlot[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    let active = true;
    setLoading(true);setError(false);setGames([]);
    fetch("/api/v1/slots/featured", { credentials: "omit", signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("Catalogue unavailable");
      const data = await response.json();
      if (!Array.isArray(data.games)) throw new Error("Invalid catalogue");
      const seen = new Set<string>();
      const selected = data.games.filter((game: FeaturedSlot) => {
        if (!game || typeof game.id !== "string" || typeof game.name !== "string" || typeof game.image !== "string" || !/^https:\/\//i.test(game.image) || seen.has(game.id)) return false;
        seen.add(game.id);return true;
      }).slice(0, 7);
      if (active) setGames(selected);
    }).catch(() => { if (active) setError(true); }).finally(() => {
      window.clearTimeout(timeout);if (active) setLoading(false);
    });
    return () => { active = false;window.clearTimeout(timeout);controller.abort(); };
  }, [retry]);

  return <section className={styles.section} aria-labelledby="home-slots-title">
    <header className={styles.heading}><h2 id="home-slots-title"><UiGlyph name="slots" size={25}/>Slots</h2>
      <Link className={styles.viewAll} href="/slots">View all<UiGlyph name="arrow" size={17}/></Link>
    </header>
    {loading ? <div className={styles.row} role="status" aria-label="Loading slots">{Array.from({length:7},(_,i)=><div className={styles.skeleton} key={i} aria-hidden="true"/>)}</div> :
      error ? <div className={styles.empty} role="alert"><span>Slots could not be loaded.</span><button onClick={() => setRetry(value => value + 1)}>Try again</button><Link href="/slots">Browse slots</Link></div> :
      games.length ? <div className={styles.row}>{games.map(game => <SlotCard key={game.id} game={game}/>)}</div> :
      <div className={styles.empty}><span>No slots are available right now.</span><Link href="/slots">View slots lobby</Link></div>}
  </section>;
}
