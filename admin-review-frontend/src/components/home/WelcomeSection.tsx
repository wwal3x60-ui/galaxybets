"use client";
import Link from 'next/link';
import Image from 'next/image';
import {useAuthStore} from '@/store/auth.store';
import stylesUpgrade from './HomeUpgrade.module.css';
import GalaxyArtwork from '@/components/ui/GalaxyArtwork';
import styles from './WelcomeSection.module.css';
const games=[{id:'mines',name:'Mines',description:'Find gems. Choose your moment.'},{id:'roulette',name:'Roulette',description:'Choose a symbol. Follow the reel.'},{id:'jackpot',name:'Jackpot',description:'One pot. One winning ticket.'},{id:'coinflip',name:'Coinflip',description:'Fire or Ice. Choose your side.'}] as const;
export default function WelcomeSection(){
 const user=useAuthStore(s=>s.user);
 return <section className={styles.welcome} aria-label="Explore GalaxyBets">
  <header className={styles.heading}><p>GALAXYBETS</p><h1>{user?.username?`Welcome back, ${user.username}.`:'Your next discovery starts here.'}</h1></header>
  <div className={styles.heroGrid} data-home-banners="stellar-v1">
   <Link href="/cases" className={styles.hero}><div className={styles.copy}><span className={styles.eyebrow}>CASE COLLECTION</span><h2>Explore cases.</h2><p>Discover Pokémon, CS and IRL collections.</p><span className={styles.primary}>Explore cases</span></div><div className={styles.art}><Image src="/assets/stellar/packs-display.png" alt="" fill priority sizes="(max-width:639px) 70vw, 480px"/></div></Link>
   <Link href="/create-battle" className={styles.battle}><div className={styles.battleCopy}><span className={styles.eyebrow}>CASE BATTLES</span><h2>Create a battle.</h2><p>Choose your cases. Meet your opponents.</p><span>Create battle</span></div><div className={styles.battleArt}><Image src="/assets/stellar/battle-display.png" alt="" fill sizes="(max-width:639px) 60vw, 400px"/></div></Link>
  </div>
  <nav className={stylesUpgrade.shortcuts} aria-label="Helpful links">
   <Link href="/fairness"><span>Fairness</span><small>Explore verification</small></Link>
   <Link href="/account/dashboard"><span>Your account</span><small>History and settings</small></Link>
   <a href="mailto:support@galaxybets.casino"><span>Need a hand?</span><small>Contact support</small></a>
  </nav>
  <div className={styles.gameHeader}><h2>GalaxyBets Originals</h2><Link href="/games">All games</Link></div>
  <div className={styles.gameLinks}>{games.map(g=><Link href={'/'+g.id} key={g.id} aria-label={'Play '+g.name}><GalaxyArtwork game={g.id}/><div><span>{g.name}</span><small>{g.description}</small></div></Link>)}</div>
 </section>;
}
