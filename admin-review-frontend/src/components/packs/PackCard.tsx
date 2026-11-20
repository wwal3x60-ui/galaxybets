"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {CircuitIcon} from "@/components/layout/MidnightShell";
import Image from "next/image";
import styles from "./PacksCatalog.module.css";
interface PackCardProps{id?:string;name:string;price:string;image:string;isOfficial?:boolean;category?:string;}
export default function PackCard({id,name,price,image,isOfficial,category}:PackCardProps){
 const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[image]);
 const badge=category==="Pokemon"?"Pokémon":category==="CSGO"?"CS:GO":category|| (isOfficial?"Official":"Case");
 return <Link href={id?`/cases/${encodeURIComponent(id)}`:"/cases"} className={styles.card} aria-label={`${name}, ${price}`}>
 <div className={styles.cardTop}><span className={styles.official}>{badge}</span><span className={styles.arrow} aria-hidden="true">↗</span></div>
 <div className={styles.art}>{failed?<div className={styles.missingArt}><CircuitIcon name="packs" size={45}/><small>Artwork unavailable</small></div>:<Image src={image} alt="" width={320} height={400} sizes="(max-width: 640px) 45vw, (max-width: 1024px) 24vw, 180px" unoptimized={!image.includes("/public/packs/")} onError={()=>setFailed(true)}/>}</div>
 <div className={styles.cardInfo}><span className={styles.name}>{name}</span><strong className={styles.price}>{price}</strong><span className={styles.open}>Open case <span aria-hidden="true">↗</span></span></div>
 </Link>;
}
