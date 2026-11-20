"use client";
import {useEffect,useRef,useState} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {caseImage,caseMoney,type ReviewCase} from '@/lib/cases/collection';
const samples=[
 {name:'Crimson Finish',type:'CS2 design',image:'rifle',color:'#e54a55'},
 {name:'Crimson Crescent',type:'Sculpture concept',image:'blade',color:'#d5ad65'},
 {name:'Circuit Gloves',type:'Glove design',image:'gloves',color:'#b194d9'},
 {name:'Steel Chronograph',type:'Watch concept',image:'watch',color:'#91b2c5'},
 {name:'Studio Audio',type:'Audio concept',image:'headphones',color:'#a6aab2'},
 {name:'Archive Edition',type:'Collectible concept',image:'card',color:'#8bbcb3'},
];
type Sample=typeof samples[number];
export default function CasePreview({item}:{item:ReviewCase}){
 const [quantity,setQuantity]=useState(1),[busy,setBusy]=useState(false),[fast,setFast]=useState(false),[results,setResults]=useState<Sample[]>([]),[favorite,setFavorite]=useState(false),[message,setMessage]=useState('');
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 useEffect(()=>{setFavorite(localStorage.getItem(`cr-favorite-${item.slug}`)==='1');return()=>{if(timer.current)clearTimeout(timer.current);};},[item.slug]);
 const toggleFavorite=()=>{const next=!favorite;setFavorite(next);localStorage.setItem(`cr-favorite-${item.slug}`,next?'1':'0');};
 const demo=()=>{if(busy)return;setBusy(true);setResults([]);setMessage('');const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;const indexes=crypto.getRandomValues(new Uint32Array(quantity));timer.current=setTimeout(()=>{setResults(Array.from(indexes,n=>samples[n%samples.length]));setBusy(false);},reduced||fast?180:1700);};
 const share=async()=>{try{await navigator.clipboard.writeText(window.location.href);setMessage('Case link copied.');}catch{setMessage('Copy the link from your address bar to share this case.');}};
 return <main className="crPage crCaseDetail">
  <nav className="crBreadcrumb" aria-label="Breadcrumb"><Link href="/cases">Cases</Link><span>/</span><span>{item.name}</span></nav>
  <section className="crCaseMasthead"><div className="crDetailArt"><Image src={caseImage(item.slug)} alt={`${item.name} original case design`} width={640} height={512} priority/></div><div className="crDetailCopy"><span className="crTag">{item.category} · Collection preview</span><h1>{item.name}</h1><p>{item.description}</p><div className="crActions"><button className="crTextButton" onClick={toggleFavorite} aria-pressed={favorite}>{favorite?'Saved to favourites':'Save case'}</button><button className="crTextButton" onClick={share}>Share case</button></div></div><div className="crOpenPanel"><h2>Explore this case</h2><div className="crPrice"><strong>{caseMoney(item.price*quantity)}</strong><span>Concept price · {quantity} {quantity===1?'case':'cases'}</span></div><fieldset disabled={busy}><legend>Quantity</legend><div className="crQuantities">{[1,2,3,4].map(n=><button key={n} aria-pressed={quantity===n} onClick={()=>setQuantity(n)}>{n}</button>)}</div></fieldset><button className="crButton crButtonPrimary crDemoButton" disabled={busy} onClick={demo}>{busy?'Opening demo…':'Try free demo'}</button><label className="crToggle"><input type="checkbox" checked={fast} onChange={e=>setFast(e.target.checked)}/>Fast animation</label><p>Visual demo only. No charge, balance change, or item awarded.</p></div></section>
  <div className="crPreviewNotice"><b>Review collection.</b> Contents are illustrative design samples. Live items, final prices, and probability tables require approval before paid opening.</div>
  <section className="crReelSection" aria-labelledby="reel-title"><div className="crSectionTitle"><h2 id="reel-title">{busy?'Opening demo':results.length?'Demo reveal':'Case preview'}</h2><Link href="/fairness">Explore verification</Link></div><div className={`crReel ${busy?'crReelSpinning':''}`} aria-busy={busy}><div className="crReelMarker" aria-hidden="true"/>{(results.length?results:samples.slice(0,5)).map((sample,i)=><div key={`${sample.name}-${i}`} className="crReelItem" style={{'--item-color':sample.color} as React.CSSProperties}><Image src={`/assets/crimson/items/${sample.image}.webp`} alt={sample.name} width={500} height={400}/><span>{sample.type}</span><strong>{sample.name}</strong></div>)}</div><p className="crDemoStatus" role="status" aria-live="polite">{busy?'The visual demo is opening.':results.length?`Demo complete: ${results.map(result=>result.name).join(', ')}. Illustrative samples only; nothing has been awarded.`:'Try a free visual preview. Every sample has an equal chance in this demonstration; these are not live game odds.'}</p></section>
  <section className="crSection"><div className="crSectionTitle"><h2>Inside the concept</h2><span>6 illustrative designs</span></div><div className="crContentsGrid">{samples.map(sample=><article className="crContentCard" key={sample.name} style={{'--item-color':sample.color} as React.CSSProperties}><Image src={`/assets/crimson/items/${sample.image}.webp`} alt={sample.name} width={500} height={400}/><small>{sample.type}</small><h3>{sample.name}</h3><span>Illustrative content</span></article>)}</div></section>
  {message&&<p role="status" className="crInlineMessage">{message}</p>}
  <div className="crDetailBottom"><Link href="/cases" className="crButton crButtonOutline">Explore all cases</Link><Link href="/cases?collection=live" className="crButton crButtonOutline">Browse live cases</Link></div>
 </main>;
}
