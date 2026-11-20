'use client';

import Link from 'next/link';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {apiClient} from '@/lib/api/client';
import {useAuthStore} from '@/store/auth.store';
import styles from './SlotsGamePlayer.module.css';

type Game={id:string;name:string;provider:string;image:string};
type Round={roundId:string;gameId:string;betTotal:string;winTotal:string;refundTotal:string;closed:boolean;createdAt:string};
type Session={game:Game;games:Game[];url:string};
const usd=(value:string|number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:4}).format(Number(value));
function errorMessage(e:unknown){
 const code=(e as {response?:{data?:{error?:string}}}).response?.data?.error;
 const labels:Record<string,string>={ACCOUNT_RESTRICTED:'Slots are unavailable for this account.',SLOTS_DISABLED:'Game launches are temporarily paused.',PROVIDER_ERROR_1040:'The provider account needs credits before this game can open.',PROVIDER_ERROR_1017:'USD is not enabled on the provider account.',PROVIDER_ERROR_1023:'The backend clock needs to be synchronized.',PROVIDER_ERROR_1014:'The provider needs your backend IP on its allow-list.',GAME_UNAVAILABLE:'This game is not currently available.'};
 return code?labels[code]||code.replaceAll('_',' '):'The game could not connect. Please try again.';
}
function Icon({name}:{name:'back'|'grid'|'heart'|'chart'|'theatre'|'expand'|'close'|'arrow'|'history'|'packs'|'battle'}){
 const paths={back:<path d="m14 5-7 7 7 7M7 12h14"/>,grid:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,heart:<path d="M20.8 5.6a5.3 5.3 0 0 0-7.5 0L12 6.9l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5L12 22l8.8-8.9a5.3 5.3 0 0 0 0-7.5Z"/>,chart:<><path d="M4 20V9m5 11V5m5 15v-8m5 8V3M2 21h20"/></>,theatre:<><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 22h8M12 18v4"/></>,expand:<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>,close:<path d="m6 6 12 12M18 6 6 18"/>,arrow:<path d="m9 5 7 7-7 7"/>,history:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,packs:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="m9 10 3-3 3 3-3 5-3-5Z"/></>,battle:<><path d="m4 3 14 14m-1-5 4 9-9-4M20 3 6 17m1-5-4 9 9-4"/></>};
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function readSaved(key:string){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(value)?value.filter((id):id is string=>typeof id==='string').slice(0,500):[];}catch{return [];}}
function save(key:string,ids:string[]){try{localStorage.setItem(key,JSON.stringify(ids));}catch{/* Session play does not depend on storage. */}}

export default function SlotsGamePlayer({gameId}:{gameId:string}){
 const {user,isAuthenticated,hasHydrated}=useAuthStore();
 const eligible=['USER','STREAMER','AFFILIATE_MANAGER','MOD','DEV','ADMIN','OWNER'].includes(String(user?.role).toUpperCase());
 const [session,setSession]=useState<Session|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 const [balance,setBalance]=useState<string|number|null>(null),[rounds,setRounds]=useState<Round[]>([]),[roundError,setRoundError]=useState(''),[sort,setSort]=useState('recent');
 const [theatre,setTheatre]=useState(false),[fullscreen,setFullscreen]=useState(false),[notice,setNotice]=useState(''),[saved,setSaved]=useState<string[]>([]),[frameLoaded,setFrameLoaded]=useState(false);
 const viewer=useRef<HTMLDivElement>(null),history=useRef<HTMLElement>(null);
 // Reuse this component's in-flight launch during React's development effect replay.
 // Launch URLs stay in memory; they are never stored in the address bar or browser storage.
 const request=useRef<{key:string;promise:Promise<Session>}|null>(null);
 const key=`${user?.id||''}:${gameId}:${attempt}`,savedKey=`galaxybets:slots:saved:${user?.id||'guest'}`,recentKey=`galaxybets:slots:recent:${user?.id||'guest'}`;
 useEffect(()=>{setSaved(readSaved(savedKey));},[savedKey]);
 const updateWallet=useCallback(async()=>{try{const r=await apiClient.get('/slots/balance');setBalance(r.data.data.Balance);}catch{/* Keep the last verified balance visible. */}},[]);
 const updateHistory=useCallback(async()=>{try{const r=await apiClient.get('/slots/history');setRounds(r.data.rounds);setRoundError('');}catch{setRoundError('Your round history is temporarily unavailable.');}},[]);
 useEffect(()=>{
  if(!hasHydrated)return;
  if(!isAuthenticated||!eligible||!gameId){setSession(null);request.current=null;setBalance(null);setRounds([]);setLoading(false);return;}
  let ignore=false;setLoading(true);setError('');setSession(null);setFrameLoaded(false);setNotice('');
  if(!request.current||request.current.key!==key){
   request.current={key,promise:(async()=>{
    const {data}=await apiClient.get('/slots/games');const games=data.games as Game[],game=games.find(g=>g.id===gameId);
    if(!game)throw {response:{data:{error:'GAME_UNAVAILABLE'}}};
    const launch=await apiClient.post('/slots/launch',{gameId,platform:window.matchMedia('(max-width:760px)').matches?'mobile':'desktop'});
    return {game,games,url:launch.data.url};
   })()};
  }
  request.current.promise.then(value=>{
   if(ignore)return;setSession(value);setLoading(false);
   const recent=[gameId,...readSaved(recentKey).filter(id=>id!==gameId)].slice(0,24);save(recentKey,recent);
  }).catch(e=>{if(!ignore){setError(errorMessage(e));setLoading(false);}});
  void updateWallet();void updateHistory();
  return()=>{ignore=true;};
 },[hasHydrated,isAuthenticated,eligible,gameId,key,recentKey,updateWallet,updateHistory]);
 useEffect(()=>{if(!session)return;const timer=window.setInterval(()=>{void updateWallet();void updateHistory();},10000);return()=>window.clearInterval(timer);},[session,updateWallet,updateHistory]);
 useEffect(()=>{const onChange=()=>setFullscreen(document.fullscreenElement===viewer.current);document.addEventListener('fullscreenchange',onChange);return()=>document.removeEventListener('fullscreenchange',onChange);},[]);
 useEffect(()=>{if(!session||frameLoaded)return;const timer=window.setTimeout(()=>setNotice('Still connecting? Some providers take longer to load. You can return to the lobby without cancelling accepted rounds.'),25000);return()=>window.clearTimeout(timer);},[session,frameLoaded]);
 const game=session?.game;
 const ownRounds=useMemo(()=>{const filtered=rounds.filter(r=>r.gameId===gameId);return sort==='payout'?[...filtered].sort((a,b)=>Number(b.winTotal)-Number(a.winTotal)):filtered;},[rounds,gameId,sort]);
 const related=useMemo(()=>session?.games.filter(g=>g.id!==gameId&&g.provider===game?.provider).slice(0,12)||[],[session,gameId,game?.provider]);
 const providerList=useMemo(()=>Array.from(new Set(session?.games.map(g=>g.provider)||[])).sort().slice(0,8),[session]);
 const totalStake=ownRounds.reduce((sum,r)=>sum+Number(r.betTotal),0),totalPayout=ownRounds.reduce((sum,r)=>sum+Number(r.winTotal),0);
 const shownBalance=balance??user?.walletBalance??user?.balance;
 function toggleFavourite(){setSaved(old=>{const next=old.includes(gameId)?old.filter(id=>id!==gameId):[gameId,...old].slice(0,500);save(savedKey,next);return next;});}
 async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else if(viewer.current?.requestFullscreen)await viewer.current.requestFullscreen();else setNotice('Fullscreen is not supported here. Theatre mode is available instead.');}catch{setNotice('Fullscreen is unavailable in this browser. Try theatre mode.');}}
 function showHistory(){history.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
 return <main className={`${styles.page} ${theatre?styles.theatre:''}`}>
  <aside className={styles.sidebar} aria-label="Casino navigation"><Link className={styles.back} href="/slots"><Icon name="back"/>Back to lobby</Link><span className={styles.navLabel}>CASINO</span><Link className={styles.navActive} href="/slots"><Icon name="grid"/>Slots</Link><Link href="/slots?view=saved"><Icon name="heart"/>Favourites</Link><Link href="/slots?view=recent"><Icon name="history"/>Recently opened</Link><div className={styles.divider}/><Link href="/cases"><Icon name="packs"/>Cases</Link><Link href="/battles"><Icon name="battle"/>Battles</Link>{providerList.length>0&&<><span className={styles.navLabel}>PROVIDERS</span>{providerList.map(p=><Link className={styles.providerLink} key={p} href={'/slots?provider='+encodeURIComponent(p)}>{p}<Icon name="arrow"/></Link>)}</>}<div className={styles.sidebarFoot}>18+ only<br/>Play responsibly</div></aside>
  <div className={styles.content}><div className={styles.breadcrumb}><Link href="/slots">Slots</Link><Icon name="arrow"/><span>{game?.name||'Game player'}</span><span className={styles.wallet}>USD <strong>{shownBalance==null?'—':usd(shownBalance)}</strong></span></div>
   <div className={styles.viewer} ref={viewer}>
    <div className={styles.screen} aria-busy={loading}>
     {!hasHydrated||loading?<div className={styles.loading}><div className={styles.star}>✦</div><span>Connecting your game</span><small>Your GalaxyBets wallet stays connected.</small><div className={styles.loadingBar}/></div>:!isAuthenticated||!eligible?<div className={styles.empty}><Icon name="grid"/><h1>{isAuthenticated?'Slots unavailable':'Sign in to play'}</h1><p>{isAuthenticated?'Slots are unavailable for this account.':'Sign in to your GalaxyBets account to open this game.'}</p><Link href="/slots">Back to slots</Link></div>:!gameId?<div className={styles.empty}><h1>Choose a game</h1><Link href="/slots">Explore the collection</Link></div>:error?<div className={styles.empty} role="alert"><span className={styles.errorSymbol}>!</span><h1>Unable to open this game</h1><p>{error}</p><div><button onClick={()=>setAttempt(n=>n+1)}>Try again</button><Link href="/slots">Back to slots</Link></div></div>:session?<iframe key={`${gameId}:${attempt}`} src={session.url} title={game?.name||'Slots game'} allow="autoplay; fullscreen" allowFullScreen referrerPolicy="no-referrer" onLoad={()=>setFrameLoaded(true)}/>:null}
    </div>
    <div className={styles.toolbar}><span className={styles.mode}><i/>Real play <small>USD</small></span><span className={styles.brand}>Galaxy<span>Bets</span></span><div className={styles.tools}><button disabled={!gameId} aria-pressed={saved.includes(gameId)} className={saved.includes(gameId)?styles.isSaved:''} title={saved.includes(gameId)?'Remove favourite':'Add to favourites'} aria-label={saved.includes(gameId)?'Remove favourite':'Add to favourites'} onClick={toggleFavourite}><Icon name="heart"/></button><button title="Your rounds" aria-label="Show your rounds" onClick={showHistory}><Icon name="chart"/></button><button title="Theatre mode" aria-label="Toggle theatre mode" aria-pressed={theatre} onClick={()=>setTheatre(v=>!v)}><Icon name="theatre"/></button><button title={fullscreen?'Exit fullscreen':'Fullscreen'} aria-label={fullscreen?'Exit fullscreen':'Fullscreen'} onClick={()=>void toggleFullscreen()}><Icon name="expand"/></button><Link title="Back to slots" aria-label="Close game and return to slots" href="/slots"><Icon name="close"/></Link></div></div>
   </div>
   {notice&&<div className={styles.notice} role="status">{notice}<button aria-label="Dismiss message" onClick={()=>setNotice('')}><Icon name="close"/></button></div>}
   <section className={styles.gameInfo}><div><span className={styles.eyebrow}>{game?.provider||'GALAXYBETS CASINO'}</span><h1>{game?.name||'Your game, your space.'}</h1><p>Play inside your GalaxyBets wallet. Game rules and payout information are available from the provider’s in-game menu.</p></div>{game&&<Link className={styles.providerBadge} href={'/slots?provider='+encodeURIComponent(game.provider)}>{game.provider}<Icon name="arrow"/></Link>}</section>
   <section className={styles.history} ref={history}><div className={styles.sectionTitle}><div><h2>Your rounds</h2><p>Actual activity for this game · Latest 50 slots rounds checked</p></div><select aria-label="Sort your rounds" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Most recent</option><option value="payout">Highest payouts</option></select></div><div className={styles.summary}><div><span>Recorded stakes</span><strong>{usd(totalStake)}</strong></div><div><span>Recorded payouts</span><strong>{usd(totalPayout)}</strong></div><div><span>Rounds in view</span><strong>{ownRounds.length}</strong></div></div><div className={styles.tableScroll}>{roundError?<p>{roundError}</p>:ownRounds.length?<table><thead><tr><th>Round</th><th>Wager</th><th>Payout</th><th>Refund</th><th>Status</th></tr></thead><tbody>{ownRounds.map(r=><tr key={r.roundId}><td title={r.roundId}>{r.roundId}<small>{new Date(r.createdAt).toLocaleString()}</small></td><td>{usd(r.betTotal)}</td><td className={Number(r.winTotal)>0?styles.positive:''}>{usd(r.winTotal)}</td><td>{usd(r.refundTotal)}</td><td><span className={r.closed?styles.settled:styles.pending}>{r.closed?'Settled':'Open'}</span></td></tr>)}</tbody></table>:<div className={styles.noRounds}><Icon name="history"/><p>No recorded rounds for this game yet.</p><small>Accepted rounds remain in your history even after leaving the game.</small></div>}</div></section>
   {related.length>0&&<section className={styles.related}><div className={styles.sectionTitle}><h2>More from {game?.provider}</h2><Link href={'/slots?provider='+encodeURIComponent(game?.provider||'')}>View provider<Icon name="arrow"/></Link></div><div className={styles.relatedGrid}>{related.map(g=><Link href={'/slots/play?game='+encodeURIComponent(g.id)} key={g.id}><div>{g.image?<img src={g.image} alt="" loading="lazy" referrerPolicy="no-referrer"/>:<span>✦</span>}</div><strong title={g.name}>{g.name}</strong><small>{g.provider}</small></Link>)}</div></section>}
   <details className={styles.info}><summary>Session information</summary><p>Real-money play · Game and provider stake limits apply. Leaving or closing a game does not cancel an accepted wager. Slots contribute 100% only to new 40× deposit-bonus claims. Ordinary deposits, tips and older bonus claims receive no slots credit. Slots do not advance levels, rewards or affiliate commissions. In-game provider content and controls are supplied by the game provider.</p></details><footer className={styles.footer}>18+ only · Play responsibly</footer>
  </div>
 </main>;
}
