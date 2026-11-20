import Link from 'next/link';
import Image from 'next/image';
import CaseCard from '@/components/crimson/CaseCard';
import GameTiles from '@/components/crimson/GameTiles';
import {caseCollection} from '@/lib/cases/collection';
import FeaturedSlotsSection from './FeaturedSlotsSection';
export default function HomePage(){
 const featured=caseCollection.filter(item=>item.featured);
 return <main className="crHome">
  <section className="crHero" aria-labelledby="home-title"><Image src="/assets/crimson/hero.webp" alt="Crimson Arena’s red and charcoal case collection" fill sizes="100vw" priority/><div className="crHeroShade"/><div className="crHeroCopy"><span className="crEyebrow"><i aria-hidden="true"/> CRIMSON ARENA</span><h1 id="home-title">Your cases.<br/><em>Your arena.</em></h1><p>Explore original cases, discover new collections, and meet your next opponent.</p><div className="crActions"><Link href="/cases" className="crButton crButtonPrimary">Browse cases</Link><Link href="/battles" className="crButton crButtonOutline">Explore battles</Link></div></div></section>
  <section className="crSection" aria-labelledby="originals-title"><div className="crSectionTitle"><h2 id="originals-title">Originals</h2><Link href="/games">Explore games</Link></div><GameTiles/></section>
  <section className="crSection" aria-labelledby="featured-title"><div className="crSectionTitle"><h2 id="featured-title">Featured cases</h2><Link href="/cases">View all 20 cases</Link></div><div className="crCaseGrid crFeaturedCases">{featured.map((item,i)=><CaseCard key={item.slug} item={item} priority={i<2}/>)}</div><p className="crCollectionNote">A first look at the new collection. Concept prices and demo openings are available for review; these cases are not available for paid opening yet.</p></section>
  <section className="crBattleFeature"><div><span className="crEyebrow">CASE BATTLES</span><h2>Choose your cases.<br/>Build your battle.</h2><p>Pick a format and take your collection head to head.</p><Link href="/battles" className="crButton crButtonPrimary">Browse battles</Link></div><Image src="/assets/crimson/cases/redline.webp" alt="Redline case" width={640} height={512}/><Image src="/assets/crimson/cases/carbon.webp" alt="Carbon case" width={640} height={512}/></section>
  <section className="crSection crHomeSlots"><FeaturedSlotsSection/></section>
  <section className="crHomeUtility"><Link href="/fairness"><strong>Explore verification</strong><span>Read how results and seeds are recorded.</span></Link><Link href="/support"><strong>Here to help</strong><span>Find account, wallet, and opening support.</span></Link><Link href="/account/settings/security"><strong>Your account</strong><span>Manage your profile and security settings.</span></Link></section>
 </main>;
}
