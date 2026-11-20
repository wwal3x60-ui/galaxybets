'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {apiClient} from '@/lib/api/client';
import {useRouter} from 'next/navigation';
import {useAuthStore} from '@/store/auth.store';
import styles from './slots.module.css';
import banner from './slots-banner.module.css';
import {useModalStore} from '@/store/modal.store';

type Game={id:string;name:string;provider:string;image:string};
type Status={configured:boolean;enabled:boolean;schemaReady:boolean;maxTestBet:string|null;maxBet?:string|null;contributions:string};
type Round={roundId:string;gameId:string;betTotal:string;winTotal:string;refundTotal:string;closed:boolean;createdAt:string};
type Collection='all'|'saved'|'recent';
const PAGE_SIZE=48;
const usd=(value:string|number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:4}).format(Number(value));
function failure(e:unknown){
 const code=(e as {response?:{data?:{error?:string}}}).response?.data?.error;
 const labels:Record<string,string>={PROVIDER_ERROR_1040:'Game launches are temporarily unavailable. Provider credits need to be added.',PROVIDER_ERROR_1023:'The backend clock needs to be synchronized before connecting.',PROVIDER_ERROR_1017:'USD needs to be enabled on the provider account.',PROVIDER_ERROR_1014:'Your backend IP needs to be approved by the provider.',SLOTS_NOT_CONFIGURED:'The slots connection is not configured yet.',SLOTS_DISABLED:'Game launches are currently paused.',ACCOUNT_RESTRICTED:'Slots are unavailable for this account.'};
 return code?labels[code]||code.replaceAll('_',' '):'We could not connect. Please try again shortly.';
}
function readIds(key:string){try{const data=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(data)?data.filter((id):id is string=>typeof id==='string').slice(0,500):[];}catch{return [];}}
function storeIds(key:string,ids:string[]){try{localStorage.setItem(key,JSON.stringify(ids));}catch{/* Browsing works when local storage is unavailable. */}}
function Symbol({kind}:{kind:'search'|'heart'|'clock'|'grid'|'arrow'|'refresh'|'close'}){
 const paths={search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,heart:<path d="M20.8 5.6a5.3 5.3 0 0 0-7.5 0L12 6.9l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 22l8.8-8.9a5.3 5.3 0 0 0 0-7.5Z"/>,clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,grid:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,arrow:<path d="m9 5 7 7-7 7"/>,refresh:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 3M18 18a8 8 0 0 1-13-3"/></>,close:<path d="m6 6 12 12M18 6 6 18"/>};
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}
export default function SlotsPage(){
 const router=useRouter();
 const openModal=useModalStore(s=>s.open);
 const {user,isAuthenticated,hasHydrated}=useAuthStore();
 const eligible=['USER','STREAMER','AFFILIATE_MANAGER','MOD','DEV','ADMIN','OWNER'].includes(String(user?.role).toUpperCase());
 const [status,setStatus]=useState<Status|null>(null),[games,setGames]=useState<Game[]>([]),[rounds,setRounds]=useState<Round[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[historyError,setHistoryError]=useState('');
 const [query,setQuery]=useState(''),[provider,setProvider]=useState('All providers'),[collection,setCollection]=useState<Collection>('all'),[sort,setSort]=useState('catalogue'),[page,setPage]=useState(1);
 const [saved,setSaved]=useState<string[]>([]),[recent,setRecent]=useState<string[]>([]),[balance,setBalance]=useState<string|number|null>(null);
 const grid=useRef<HTMLElement>(null);
 const savedKey=`galaxybets:slots:saved:${user?.id||'guest'}`,recentKey=`galaxybets:slots:recent:${user?.id||'guest'}`;
 useEffect(()=>{setSaved(readIds(savedKey));setRecent(readIds(recentKey));},[savedKey,recentKey]);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');setHistoryError('');
  try{
   const {data:s}=await apiClient.get<Status>('/slots/status');setStatus(s);
   if(!s.configured||!s.enabled||!s.schemaReady){setGames([]);return;}
   const [catalogue,wallet,history]=await Promise.allSettled([apiClient.get('/slots/games'),apiClient.get('/slots/balance'),apiClient.get('/slots/history')]);
   if(catalogue.status==='fulfilled')setGames(catalogue.value.data.games);else setError(failure(catalogue.reason));
   if(wallet.status==='fulfilled')setBalance(wallet.value.data.data.Balance);
   if(history.status==='fulfilled')setRounds(history.value.data.rounds);else setHistoryError('Round history is temporarily unavailable.');
  }catch(e){setError(failure(e));}finally{setLoading(false);}
 },[]);
 useEffect(()=>{setStatus(null);setGames([]);setRounds([]);setBalance(null);if(isAuthenticated&&eligible)void refresh();else if(hasHydrated)setLoading(false);},[isAuthenticated,eligible,hasHydrated,user?.id,refresh]);
 useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get('view')==='saved')setCollection('saved');else if(params.get('view')==='recent')setCollection('recent');if(params.get('provider'))setProvider(params.get('provider')!);},[]);
 const providers=useMemo(()=>{const counts=new Map<string,number>();for(const g of games)counts.set(g.provider,(counts.get(g.provider)||0)+1);return [...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));},[games]);
 const visible=useMemo(()=>{
  let result=games.filter(g=>(provider==='All providers'||g.provider===provider)&&`${g.name} ${g.provider}`.toLowerCase().includes(query.trim().toLowerCase())&&(collection==='all'||(collection==='saved'?saved:recent).includes(g.id)));
  if(sort==='az')result=[...result].sort((a,b)=>a.name.localeCompare(b.name));else if(sort==='za')result=[...result].sort((a,b)=>b.name.localeCompare(a.name));else if(collection==='recent')result=[...result].sort((a,b)=>recent.indexOf(a.id)-recent.indexOf(b.id));return result;
 },[games,provider,query,collection,saved,recent,sort]);
 const pages=Math.max(1,Math.ceil(visible.length/PAGE_SIZE)),current=Math.min(page,pages),offset=(current-1)*PAGE_SIZE,batch=visible.slice(offset,offset+PAGE_SIZE);
 const realBalance=balance??user?.walletBalance??user?.balance;
 const ready=status?.configured&&status?.enabled&&status?.schemaReady;
 function resetFilters(){setQuery('');setProvider('All providers');setCollection('all');setPage(1);}
 function toggleSaved(id:string){setSaved(previous=>{const next=previous.includes(id)?previous.filter(item=>item!==id):[id,...previous].slice(0,500);storeIds(savedKey,next);return next;});}
 function pick(g:Game){router.push('/slots/play?game='+encodeURIComponent(g.id));}
 function goToPage(value:number){setPage(value);grid.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
 const heading=collection==='saved'?'Your favourites':collection==='recent'?'Recently opened':provider==='All providers'?'All slots':provider;
 return <main className={styles.page}>
  <div className={styles.breadcrumb}><a href="/games">Casino</a><Symbol kind="arrow"/><span>Slots</span></div>
  <header className={banner.hero}>
   <h1 className={styles.sr}>A universe of slots.</h1>
   <img className={banner.art} src="/assets/slots/anubis-zeus-banner-v1.webp" width={1983} height={793} fetchPriority="high" decoding="async" alt="Anubis and Zeus stand back-to-back with folded arms against a purple galaxy. Featured providers: Pragmatic Play, Hacksaw Gaming, Play’n GO, BGaming and Red Tiger."/>
   <div className={banner.meta} aria-live="polite"><span><i/>{!hasHydrated?'Loading…':!isAuthenticated?'Sign in to browse':!eligible?'Account unavailable':loading?'Loading collection…':games.length?`${games.length.toLocaleString()} games`:ready&&!error?'Catalogue unavailable':'Collection unavailable'}</span>{isAuthenticated&&eligible&&!loading&&providers.length>0&&<span>{providers.length} providers</span>}<span>One wallet</span></div>
  </header>
  <div className={styles.topline}><span className={styles.preview}><i/>Slots</span><span className={styles.balance}>Your balance <strong>{realBalance==null?'—':usd(realBalance)}</strong></span><button className={styles.iconButton} aria-label="Refresh catalogue and balance" title="Refresh" disabled={loading||!isAuthenticated||!eligible} onClick={()=>void refresh()}><Symbol kind="refresh"/></button></div>
  {!isAuthenticated||!eligible?<div className={styles.empty}><Symbol kind="grid"/><h2>{isAuthenticated?'Slots unavailable':'Sign in to explore slots'}</h2><p>{isAuthenticated?'Slots are unavailable for this account.':'Sign in to your GalaxyBets account to explore the collection and play.'}</p>{!isAuthenticated&&<button onClick={()=>openModal('login')}>Sign in to browse slots <Symbol kind="arrow"/></button>}</div>:<>
   {error&&<div className={styles.error} role="alert"><span>{error}</span><button onClick={()=>void refresh()}>Try again</button></div>}
   {!loading&&status&&!ready&&<div className={styles.error}><span>{!status.schemaReady?'Finish the slots database setup to connect your games.':!status.configured?'Connect your provider account to load the collection.':'Game launches are currently paused.'}</span></div>}
   <section className={styles.browser} ref={grid} aria-label="Browse slots">
    <div className={styles.controls}><div className={styles.tabs} aria-label="Game collection">{([{id:'all',label:'All games',icon:'grid'},{id:'saved',label:'Favourites',icon:'heart'},{id:'recent',label:'Recently opened',icon:'clock'}] as const).map(t=><button key={t.id} aria-pressed={collection===t.id} className={collection===t.id?styles.tabActive:''} onClick={()=>{setCollection(t.id);setPage(1);}}><Symbol kind={t.icon}/>{t.label}{t.id==='saved'&&saved.length>0&&<small>{saved.filter(id=>games.some(g=>g.id===id)).length}</small>}</button>)}</div><label className={styles.search}><Symbol kind="search"/><input aria-label="Search slots" placeholder="Search games or providers" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/>{query&&<button aria-label="Clear search" onClick={()=>{setQuery('');setPage(1);}}><Symbol kind="close"/></button>}</label></div>
    <div className={styles.providers}><button className={provider==='All providers'?styles.providerActive:''} onClick={()=>{setProvider('All providers');setPage(1);}}>All providers</button>{providers.slice(0,7).map(p=><button key={p.name} className={provider===p.name?styles.providerActive:''} onClick={()=>{setProvider(p.name);setPage(1);}}>{p.name}<small>{p.count}</small></button>)}<label className={styles.providerSelect}><span className={styles.sr}>Choose any provider</span><select value={provider} onChange={e=>{setProvider(e.target.value);setPage(1);}}><option>All providers</option>{[...providers].sort((a,b)=>a.name.localeCompare(b.name)).map(p=><option key={p.name} value={p.name}>{p.name} ({p.count})</option>)}</select></label></div>
    <div className={styles.sectionHeading}><div><h2>{heading}</h2><span>{visible.length.toLocaleString()} games</span></div><label>Sort by <select aria-label="Sort games" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="catalogue">Catalogue order</option><option value="az">Name A–Z</option><option value="za">Name Z–A</option></select></label></div>
    {loading?<div className={styles.grid} aria-label="Loading games">{Array.from({length:12},(_,i)=><div key={i} className={styles.skeleton}><div/><span/><small/></div>)}</div>:<>
    <div className={styles.grid}>{batch.map(g=><article key={g.id} className={styles.card}><div className={styles.art}><button className={styles.gameButton} aria-label={`Open ${g.name}`} onClick={()=>pick(g)}><span className={styles.imageFallback} aria-hidden="true">✦</span>{g.image&&<img src={g.image} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={e=>{e.currentTarget.style.display='none';}}/>}<span className={styles.play}><span>▶</span>Open game</span></button><button className={`${styles.save} ${saved.includes(g.id)?styles.saved:''}`} aria-label={`${saved.includes(g.id)?'Remove':'Save'} ${g.name} ${saved.includes(g.id)?'from':'to'} favourites`} aria-pressed={saved.includes(g.id)} onClick={()=>toggleSaved(g.id)}><Symbol kind="heart"/></button></div><div className={styles.caption}><h3 title={g.name}>{g.name}</h3><span title={g.provider}>{g.provider}</span></div></article>)}</div>
    {!batch.length&&ready&&!error&&<div className={styles.empty}><Symbol kind={collection==='saved'?'heart':collection==='recent'?'clock':'search'}/><h2>{collection==='saved'?'Build your own collection':collection==='recent'?'Your orbit starts here':'No games found'}</h2><p>{collection==='saved'?'Tap the heart on any game to save it here.':collection==='recent'?'Games you open will appear here for easy access.':'Try another name or clear your filters.'}</p><button onClick={resetFilters}>Explore all games <Symbol kind="arrow"/></button></div>}
    {visible.length>0&&<div className={styles.pagination}><p>Showing <strong>{offset+1}–{Math.min(offset+PAGE_SIZE,visible.length)}</strong> of {visible.length.toLocaleString()} games</p><div><button disabled={current===1} onClick={()=>goToPage(current-1)} aria-label="Previous page"><span className={styles.previous}><Symbol kind="arrow"/></span></button><span>Page <strong>{current}</strong> / {pages}</span><button disabled={current===pages} onClick={()=>goToPage(current+1)} aria-label="Next page"><Symbol kind="arrow"/></button></div></div>}
    </>}
   </section>
   <details className={styles.history}><summary><span><Symbol kind="clock"/>Your recent rounds</span><span>{rounds.length} recorded<Symbol kind="arrow"/></span></summary><div className={styles.tableScroll}>{historyError?<p>{historyError}</p>:rounds.length?<table><thead><tr><th>Game / round</th><th>Stake</th><th>Payout</th><th>Refund</th><th>Status</th></tr></thead><tbody>{rounds.map(r=><tr key={r.roundId}><td>{games.find(g=>g.id===r.gameId)?.name||r.gameId}<small>{r.roundId}</small></td><td>{usd(r.betTotal)}</td><td>{usd(r.winTotal)}</td><td>{usd(r.refundTotal)}</td><td><span className={r.closed?styles.settled:styles.pending}>{r.closed?'Settled':'Open'}</span></td></tr>)}</tbody></table>:<p>Your completed and pending rounds will appear here.</p>}</div></details>
   <details className={styles.testing}><summary>Slots information</summary><p>Real-money sessions · {status?.maxBet||status?.maxTestBet?`Maximum stake ${usd(status.maxBet||status.maxTestBet!)} per bet.`:'Game and provider stake limits apply.'} {status?.contributions||'Slots contribute only to eligible new 40× deposit-bonus claims. They do not advance levels, rewards or affiliate commission.'} Favourites and recently opened games are saved in this browser.</p></details>
  </>}
  <footer className={styles.footer}><span>18+ only</span><i/>Play responsibly</footer>

 </main>;
}
