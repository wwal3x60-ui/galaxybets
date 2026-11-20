"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPacks, type Pack, type PackCategory } from "@/lib/api/packs";
import PackCard from "@/components/packs/PackCard";
import styles from "./HomeUpgrade.module.css";

const categories: { id: PackCategory; label: string }[] = [
  { id: "All", label: "All cases" },
  { id: "Pokemon", label: "Pokémon" },
  { id: "CSGO", label: "CS" },
  { id: "IRL", label: "IRL" },
];

export default function NewPacksSection() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [category, setCategory] = useState<PackCategory>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    getPacks({ limit: 4, category, sort: "Newest" }, { throwOnError: true })
      .then(result => { if (active) setPacks(result.packs); })
      .catch(() => { if (active) { setPacks([]); setError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, retry]);

  return (
    <section className={styles.featured} aria-labelledby="home-packs-title">
      <header className={styles.sectionHeading}>
        <div><h2 id="home-packs-title">Discover cases</h2><p>Browse collections and compare prices.</p></div>
        <Link className={styles.viewAll} href="/cases">View all cases</Link>
      </header>
      <div className={styles.browseTools}>
        <div className={styles.categories} role="group" aria-label="Case categories">
          {categories.map(item => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}
        </div>
        <form className={styles.search} action="/cases" method="get" role="search" aria-label="Search cases">
          <label className={styles.srOnly} htmlFor="home-pack-search">Search cases</label>
          <input id="home-pack-search" name="search" type="search" placeholder="Find a case…" maxLength={100} required />
          <button type="submit">Search</button>
        </form>
      </div>
      <div aria-busy={loading}>
        {loading ? <div className={styles.packGrid} role="status"><span className={styles.srOnly}>Loading cases</span>{Array.from({ length: 4 }, (_, i) => <div key={i} className={styles.skeleton} aria-hidden="true" />)}</div>
          : error ? <div className={styles.empty} role="alert"><p>We couldn’t load the cases. Please try again.</p><button type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>
          : packs.length ? <div className={styles.packGrid}>{packs.map(pack => <PackCard key={pack.id} {...pack} />)}</div>
          : <div className={styles.empty} role="status"><p>No cases are available in this category yet.</p><Link href="/cases">Browse all cases</Link></div>}
      </div>
    </section>
  );
}
