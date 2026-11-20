"use client";
import {useEffect,useState} from 'react';
import {useCommunityStore} from '@/store/community.store';
import Link from 'next/link';
import {getLiveOpens,getTopOpens} from '@/lib/api/live-opens';
import {mergeDrops,subscribeLiveOpens,type LiveDrop} from '@/lib/live-open-view';
import styles from './LiveOpensSidebar.module.css';
function Card({item}:{item:LiveDrop}){const content=<><span className={styles.player}>{item.user.avatar&&<img src={item.user.avatar} alt=""/>}<span>{item.user.name}</span>{item.user.isBot&&<small>BOT</small>}</span><img className={styles.product} src={item.image} alt={item.name}/><span className={styles.name}>{item.name}</span><strong>{Number(item.price).toLocaleString('en-US',{style:'currency',currency:'USD'})}</strong></>;return item.packId?<Link className={styles.card} href={'/cases/'+encodeURIComponent(item.packId)} title={item.name}>{content}</Link>:<div className={styles.card}>{content}</div>;}
export default function LiveOpensSidebar(props:{maxHeight?:number}={}){const open=useCommunityStore(s=>!!s.view);return open?null:<LiveOpensContents {...props}/>;}
function LiveOpensContents({maxHeight}:{maxHeight?:number}={}){
 const [top,setTop]=useState<LiveDrop[]>([]),[recent,setRecent]=useState<LiveDrop[]>([]),[loading,setLoading]=useState(true),[unavailable,setUnavailable]=useState(false),[connected,setConnected]=useState(false);
 useEffect(()=>{let active=true;
  const refresh=async()=>{const results=await Promise.allSettled([getTopOpens(3),getLiveOpens(16)]);if(!active)return;const [t,r]=results;if(t.status==='fulfilled')setTop(p=>mergeDrops(p,t.value,3,true));if(r.status==='fulfilled')setRecent(p=>mergeDrops(p,r.value,16));setUnavailable(results.every(x=>x.status==='rejected'));setLoading(false);};
  const stop=subscribeLiveOpens(item=>{if(!active)return;setRecent(p=>mergeDrops(p,[item],16));setTop(p=>mergeDrops(p,[item],3,true));setLoading(false);setUnavailable(false);},setConnected);
  void refresh();const timer=setInterval(()=>{void refresh();},15000);
  return()=>{active=false;stop();clearInterval(timer);};
 },[]);
 const empty=(text:string)=><p className={styles.empty}>{loading?'Loading drops…':unavailable?'Drops temporarily unavailable.':text}</p>;
 return <aside className={styles.sidebar} style={maxHeight?{maxHeight}:undefined}><h2>Top Opens</h2><div className={styles.top}>{top.length?top.map(item=><Card key={item.id} item={item}/>):empty('No case opens yet.')}</div><h2 className={styles.live}>Live Drops <span className={connected?styles.connected:styles.polling}>{connected?'Live':'Updating'}</span></h2><div className={styles.recent}>{recent.length?recent.map(item=><Card key={item.id} item={item}/>):empty('New case opens will appear here.')}</div></aside>;
}
