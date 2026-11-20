'use client';
import type {ReactNode} from 'react';
import Link from 'next/link';
import {useState} from 'react';
import styles from './HouseGamePaused.module.css';
export default function HouseGamePaused({name,settlement,children}:{name:string;settlement?:boolean;children:ReactNode}){
 const [show,setShow]=useState(false);
 return <section className={styles.page}><div className={styles.panel}><span className={styles.tag}><i/>TEMPORARILY UNAVAILABLE</span><div className={styles.emblem} aria-hidden="true"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="13" y="10" width="4" height="20" rx="1"/><rect x="23" y="10" width="4" height="20" rx="1"/></svg></div><h1>{name==='House games'?'House games are taking a break.':`${name} is taking a break.`}</h1><p>Keno is temporarily paused.<br/>Other house games, Cases, Battles and slots remain available.</p><div className={styles.links}><Link href="/cases">Explore cases <span>↗</span></Link><Link href="/battles">Case battles</Link><Link href="/slots">Browse slots</Link></div><small>Choose another game while Keno is unavailable.</small>{settlement&&<button className={styles.manage} onClick={()=>setShow(v=>!v)} aria-expanded={show}>{show?'Hide existing-round controls':'Already have an active round?'}</button>}</div>{show&&settlement&&<div className={styles.settlement}><div>Existing rounds only. New wagers remain disabled.</div>{children}</div>}</section>;
}
