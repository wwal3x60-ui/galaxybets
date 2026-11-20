"use client";
import { SlotsEntry } from './SlotsEntry';

import Link from "next/link";
import { gameItems, type GameKind } from "@/lib/constants/navigation";
import styles from "./Navigation.module.css";

function GameIcon({ kind }: { kind: GameKind }) {
  return <span className={`${styles.gameIcon} ${styles[kind]}`} aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {kind === "roulette" ? <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v5m0 6v5M4 12h5m6 0h5M6.4 6.4l3.5 3.5m4.2 4.2 3.5 3.5m0-11.2-3.5 3.5m-4.2 4.2-3.5 3.5"/></>
      : kind === "mines" ? <><path d="m12 3 9 7-9 11L3 10l9-7Z"/><path d="M3 10h18M8 4.9l4 5.1 4-5.1M12 10v11"/></>
      : kind === "coinflip" ? <><circle cx="9" cy="12" r="7"/><path d="M15 5.3a7 7 0 1 1 0 13.4M9 8v8M7 9h3a1.5 1.5 0 0 1 0 3H8a1.5 1.5 0 0 0 0 3h3"/></>
      : kind === "keno" ? <><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="8" cy="16" r="1"/><path d="m13 15 2 2 4-5"/></>
      : <><path d="M5 7h14v12H5zM8 4h8M9 11v4m3-4v4m3-4v4M19 9h2v5h-2M8 21h8"/></>}
    </svg>
  </span>;
}
export function GameLinks({pathname, onNavigate}: {pathname:string; onNavigate?:()=>void}) {
  return <ul className={styles.gameList}>
    {gameItems.map(game=>{
      const active = pathname === game.href || pathname.startsWith(game.href + "/");
      return <li key={game.href}><Link href={game.href} onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`${styles.gameLink} ${active ? styles.gameActive : ""}`}>
        <GameIcon kind={game.kind}/><span>{game.label}</span>
      </Link></li>;
    })}
    <li><Link href="/games" onClick={onNavigate} className={styles.gameLink}>All games <span aria-hidden="true">→</span></Link></li>
  <SlotsEntry className={styles.gameLink} onNavigate={onNavigate}/>
  </ul>;
}
