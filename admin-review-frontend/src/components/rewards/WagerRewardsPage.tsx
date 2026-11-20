"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {apiClient} from '@/lib/api/client';
import {useAuthStore} from '@/store/auth.store';
import {useModalStore} from '@/store/modal.store';
import LevelBadge from './LevelBadge';
import styles from './WagerRewardsPage.module.css';

type Level={level:number;id:string;threshold:string;reward:string};
type Milestone=Level&{claimed:boolean;claimable:boolean;claimedAt:string|null;claimedReward:string|null;progress:number;remaining:string};
type Catalog={version:string;levelCount:number;levels:Level[]};
type Progress={version:string;levelCount:number;balance:string;totalWagered:string;currentLevel:number;nextLevel:{level:number;threshold:string;remaining:string;progress:number;wageredInLevel:string;requiredInLevel:string}|null;availableReward:string;totalClaimed:string;claimedCount:number;milestones:Milestone[]};
type Filter='all'|'ready'|'claimed';
const usd=(v:string)=>Number(v).toLocaleString('en-US',{style:'currency',currency:'USD'});
const compact=(v:string)=>Number(v).toLocaleString('en-US',{maximumFractionDigits:2});
const date=(v:string)=>new Date(v).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
const supported=(v:{version?:string;levelCount?:number})=>v.version==='galaxy-passport-v1'&&v.levelCount===20;
function MiniIcon({name}:{name:'lock'|'check'|'gift'|'refresh'|'shield'}){
 return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name==='lock'?<><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>:name==='check'?<path d="m5 12 4 4L19 6"/>:name==='gift'?<><path d="M3 9h18v5H3zM5 14v7h14v-7M12 9v12M12 9C3 9 5 0 9 4l3 5Zm0 0c9 0 7-9 3-5l-3 5Z"/></>:name==='refresh'?<><path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/></>:<><path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/></>}</svg>;
}
export default function WagerRewardsPage(){
 const {isAuthenticated,hasHydrated,token}=useAuthStore(),open=useModalStore(s=>s.open);
 const [data,setData]=useState<Progress|null>(null),[catalog,setCatalog]=useState<Level[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[claiming,setClaiming]=useState<string|null>(null),[notice,setNotice]=useState(''),[filter,setFilter]=useState<Filter>('all');
 const session=useRef(0),readEpoch=useRef(0),lock=useRef(false);
 const load=useCallback(async()=>{
  const version=session.current,epoch=++readEpoch.current,expected=token,balanceAtStart=useAuthStore.getState().user?.walletBalance;
  if(!hasHydrated)return null;
  setLoading(true);setError('');
  try{
   if(isAuthenticated&&expected){
    const res=await apiClient.get<Progress>('/user/wager-rewards');
    if(!supported(res.data)||res.data.milestones?.length!==20)throw new Error('BACKEND_UPDATE_REQUIRED');
    if(version!==session.current||epoch!==readEpoch.current||useAuthStore.getState().token!==expected)return null;
    setData(res.data);setCatalog(res.data.milestones);
    const store=useAuthStore.getState();if(store.user?.walletBalance===balanceAtStart&&Number.isFinite(Number(res.data.balance)))store.updateUser({balance:Number(res.data.balance),walletBalance:res.data.balance});
    return res.data;
   }
   const res=await apiClient.get<Catalog>('/user/wager-rewards/levels');
   if(!supported(res.data)||res.data.levels?.length!==20)throw new Error('BACKEND_UPDATE_REQUIRED');
   if(version===session.current&&epoch===readEpoch.current)setCatalog(res.data.levels);
   return null;
  }catch(e:unknown){
   if(version===session.current&&epoch===readEpoch.current){const code=(e as {response?:{status?:number;data?:{error?:string}}})?.response?.data?.error,status=(e as {response?:{status?:number}})?.response?.status;
    setError(e instanceof Error&&e.message==='BACKEND_UPDATE_REQUIRED'||status===404?'The 20-level Rewards backend needs restarting with the updated launcher.':code==='ACCOUNT_RESTRICTED'?'This account cannot claim level rewards.':status===401?'Your session has expired. Please log in again.':'Rewards could not be loaded. Please try again.');}
   return null;
  }finally{if(version===session.current&&epoch===readEpoch.current)setLoading(false);}
 },[token,isAuthenticated,hasHydrated]);
 useEffect(()=>{
  session.current++;setData(null);setCatalog([]);setNotice('');setError('');setFilter('all');lock.current=false;setClaiming(null);
  if(hasHydrated)void load();
  const focus=()=>{if(document.visibilityState==='visible'&&!lock.current)void load();};
  document.addEventListener('visibilitychange',focus);
  return()=>{session.current++;document.removeEventListener('visibilitychange',focus);};
 },[hasHydrated,load]);
 const claim=async(id:string)=>{
  if(lock.current||!isAuthenticated||!token)return;
  const expected=token,version=session.current,balanceAtStart=useAuthStore.getState().user?.walletBalance;
  lock.current=true;setClaiming(id);setNotice('');setError('');
  try{
   const res=await apiClient.post<{alreadyClaimed:boolean;reward:string;balance:string}>(`/user/wager-rewards/${encodeURIComponent(id)}/claim`,{});
   if(version!==session.current||useAuthStore.getState().token!==expected)return;
   const store=useAuthStore.getState();if(store.user?.walletBalance===balanceAtStart&&Number.isFinite(Number(res.data.balance)))store.updateUser({balance:Number(res.data.balance),walletBalance:res.data.balance});
   setNotice(res.data.alreadyClaimed?'This level reward has already been collected.':`${usd(res.data.reward)} added to your balance.`);
   await load();
  }catch(e:unknown){
   if(version!==session.current||useAuthStore.getState().token!==expected)return;
   const refreshed=await load();if(version!==session.current)return;
   if(refreshed?.milestones.find(m=>m.id===id)?.claimed)setNotice('Your reward claim is confirmed. Your balance has been refreshed.');
   else{const code=(e as {response?:{data?:{error?:string}}})?.response?.data?.error;setError(code==='WAGER_TARGET_NOT_REACHED'?'This level has not been reached yet.':code==='ACCOUNT_RESTRICTED'?'This account cannot claim rewards.':'The claim could not be confirmed. Refresh your progress before retrying.');}
  }finally{if(version===session.current){lock.current=false;setClaiming(null);}}
 };
 const levels:Array<Level|Milestone>=data?.milestones||catalog;
 const visible=levels.filter(m=>filter==='all'||'claimed'in m&&(filter==='claimed'?m.claimed:m.claimable));
 const ready=data?.milestones.filter(m=>m.claimable)||[],next=data?.nextLevel,summaryReady=ready[0],personal=data&&isAuthenticated;
 return <section className={styles.page} data-rewards-page="galaxy-passport-v1"><div className={styles.layout}>
  <aside className={styles.profile} aria-label="Your rewards level">
   <div className={styles.profileTop}><span>GALAXY PASSPORT</span><span>{personal?`${data.currentLevel} / 20`:'20 LEVELS'}</span></div>
   <LevelBadge level={personal?data.currentLevel:0} className={styles.heroBadge}/>
   <p className={styles.eyebrow}>{personal?'YOUR CURRENT LEVEL':'YOUR REWARDS JOURNEY'}</p>
   <h2 className={styles.levelTitle}>{personal?data.currentLevel>0?`Level ${data.currentLevel}`:'Getting started':'Your galaxy awaits'}</h2>
   <p className={styles.levelSubtitle}>{personal?data.currentLevel===20?'All 20 levels unlocked.':next?`Next stop: Level ${next.level}`:'':'A one-time reward at every level.'}</p>
   <div className={styles.lifetime}><strong>{personal?usd(data.totalWagered):'—'}</strong><span>Lifetime qualifying wagering</span></div>
   <div className={styles.levelProgress}>
    <div className={styles.progressLabel}><span>{personal?next?`Progress to Level ${next.level}`:'Maximum level reached':'Log in to view your progress'}</span><strong>{personal?`${next?.progress.toFixed(1)||'100'}%`:'—'}</strong></div>
    <div className={styles.track} role="progressbar" aria-label="Progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={personal?next?.progress??100:0}><i style={{width:`${personal?next?.progress??100:0}%`}}/></div>
    <p>{personal?next?`${usd(next.wageredInLevel)} / ${usd(next.requiredInLevel)} in this level`:'Your rewards remain available to collect.':'Your completed paid wagers build your level.'}</p>
    {personal&&next&&<span className={styles.nextTarget}>{usd(next.remaining)} to Level {next.level}</span>}
   </div>
   <div className={styles.claimPanel}><div><MiniIcon name="gift"/><span>{personal?'Ready to collect':'LEVEL REWARDS'}</span></div><strong>{personal?usd(data.availableReward):'20 one-time rewards'}</strong>
    {!isAuthenticated?<button className={styles.primary} type="button" onClick={()=>open('login')}>Log in to view rewards</button>:summaryReady?<button className={styles.primary} type="button" disabled={loading||claiming!==null} onClick={()=>void claim(summaryReady.id)}>{claiming===summaryReady.id?'Confirming…':`Claim Level ${summaryReady.level} · ${usd(summaryReady.reward)}`}</button>:<p>{personal?'No unclaimed rewards are ready yet.':'Loading your rewards…'}</p>}
   </div>
   {personal&&<div className={styles.claimedTotal}><span>Total collected</span><strong>{usd(data.totalClaimed)}</strong></div>}
   <div className={styles.profileFoot}><MiniIcon name="shield"/><span>One claim per level.<br/>Lifetime progress never resets.</span></div>
  </aside>
  <div className={styles.content}>
   <header className={styles.header}><div><span className={styles.eyebrow}>GALAXYBETS · GALAXY PASSPORT</span><h1>Level rewards</h1><p>Your progress. Your rewards. Yours to collect.</p></div><button className={styles.refresh} type="button" disabled={loading||claiming!==null||!hasHydrated} onClick={()=>void load()} aria-label="Refresh reward progress"><MiniIcon name="refresh"/><span>{loading?'Refreshing…':'Refresh'}</span></button></header>
   <div className={styles.features}><span><MiniIcon name="gift"/>A reward at every level</span><span><MiniIcon name="check"/>20 levels · claim each once</span></div>
   <div className={styles.tabs} role="group" aria-label="Filter level rewards">{([['all','All levels'],['ready','Ready to claim'],['claimed','Claimed']]as const).map(([id,label])=><button type="button" key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)} disabled={!isAuthenticated&&id!=='all'}>{label}{data&&<span>{id==='all'?20:id==='ready'?ready.length:data.milestones.filter(m=>m.claimed).length}</span>}</button>)}</div>
   {error&&<div className={styles.error} role="alert"><p>{error}</p><button type="button" disabled={loading} onClick={()=>void load()}>Try again</button></div>}
   {notice&&<p className={styles.notice} role="status"><MiniIcon name="check"/>{notice}</p>}
   {!hasHydrated||loading&&levels.length===0?<div className={styles.empty} role="status">Loading level rewards…</div>:levels.length===0?<div className={styles.empty}>The reward list is unavailable. Refresh to try again.</div>:<>
    <div className={styles.tableHead} aria-hidden="true"><span>LEVEL</span><span>TOTAL WAGERING</span><span>REWARD</span><span>STATUS</span></div>
    <ol className={styles.rows} aria-label="One-time level rewards">{visible.map(m=>{const state='claimed'in m?m:null,claimed=state?.claimed===true,claimable=state?.claimable===true,current=personal&&data.currentLevel===m.level;return <li key={m.id} className={styles.row} data-state={claimed?'claimed':claimable?'ready':'locked'} data-current={current}>
     <div className={styles.levelCell}><LevelBadge level={m.level} className={styles.rowBadge}/><div><h2>Level {m.level}</h2>{claimed?<span>Collected {state?.claimedAt?date(state.claimedAt):''}</span>:claimable?<span className={styles.readyLabel}>Ready to collect</span>:current?<span>Current level</span>:<span>{m.level===20?'Final level':'Lifetime milestone'}</span>}</div></div>
     <div className={styles.thresholdCell}><span className={styles.mobileLabel}>Total wagering</span><strong>${compact(m.threshold)}</strong>{state&&!claimed&&!claimable&&<><div className={styles.rowTrack} aria-hidden="true"><i style={{width:`${state.progress}%`}}/></div><small>{usd(state.remaining)} remaining</small></>}</div>
     <div className={styles.rewardCell}><span className={styles.mobileLabel}>Reward</span><strong>{usd(claimed&&state?.claimedReward?state.claimedReward:m.reward)}</strong></div>
     <div className={styles.actionCell}>{!isAuthenticated?<span className={styles.locked}><MiniIcon name="lock"/>Log in</span>:claimed?<span className={styles.collected}><MiniIcon name="check"/>Claimed</span>:claimable?<button type="button" className={styles.primary} disabled={loading||claiming!==null} onClick={()=>void claim(m.id)}>{claiming===m.id?'Confirming…':`Claim ${usd(m.reward)}`}</button>:<span className={styles.locked}><MiniIcon name="lock"/>Locked</span>}</div>
    </li>;})}</ol>
    {visible.length===0&&<div className={styles.empty}>{filter==='claimed'?'No rewards claimed yet. Your collected rewards will appear here.':'No rewards are ready to collect yet.'}</div>}
   </>}
   <div className={styles.terms}><MiniIcon name="shield"/><div><h2>One-time rewards. Lifetime progress.</h2><p>Completed paid Cases, Battles and Originals wagers count toward these cumulative targets. Deposits, tips and transfers do not count as wagering. Rewards stack: at $1,000 wagered, Levels 1–4 offer $37 in total.</p><p>Each level pays 2% of its wagering target, once per account. Claims credit your site balance; existing withdrawal and wagering requirements still apply.</p></div></div>
  </div>
 </div></section>;
}
