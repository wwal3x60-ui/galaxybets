"use client";
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import type {ReactNode} from 'react';
import styles from './SiteSurface.module.css';
export default function SiteSurface({children}:{children:ReactNode}){const pathname=usePathname();const house=['/keno','/mines','/roulette','/jackpot','/coinflip'].includes(pathname);return <div data-section={pathname.split("/")[1]||"home"} className={`${styles.surface} ${house?styles.house:''}`}>{house&&<div className={styles.gameBar}><Link href="/games">← All games</Link><span>GALAXYBETS ORIGINALS</span></div>}{children}</div>}
