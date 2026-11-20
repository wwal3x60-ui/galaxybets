'use client';
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {useReducedMotion} from 'framer-motion';
import {playTick,playExtraWin} from '@/lib/audio';
import {fireBattleCelebration} from '@/lib/confetti';
import {validateBattleTicket,playerStripFrame,playerStripLanding,playerStripTranslation,PLAYER_STRIP_CYCLES,type TicketRange} from '@/lib/utils/battle-ticket-rng';
import styles from './BattleTicketRng.module.css';
type Phase='waiting'|'revealing'|'complete';
const money=(value:string|undefined)=>value!==undefined&&value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value).toLocaleString('en-US',{style:'currency',currency:'USD'}):'—';
export default function BattleTicketRng({segments,ticket,winnerId,phase,fast=false,pot,onReplay,onFinished,onRefresh}:{segments:TicketRange[];ticket?:number;winnerId:string|null;phase:Phase;fast?:boolean;pot?:string;onReplay?:()=>void;onFinished:()=>void;onRefresh:()=>void}){
 const reduced=useReducedMotion(),signature=JSON.stringify({segments,ticket,winnerId});
 const result=useMemo(()=>validateBattleTicket(segments,ticket,winnerId),[signature]);
 const target=result.ok&&ticket!==undefined?playerStripLanding(ticket,result.total):1.5;
 const [position,setPosition]=useState(phase==='complete'?target:1.5),[done,setDone]=useState(phase==='complete');
 const finish=useRef(onFinished),completedKey=useRef<string|null>(null);finish.current=onFinished;
 useEffect(()=>{
  if(!result.ok||ticket===undefined)return;
  if(phase==='complete'){setPosition(target);setDone(true);return;}
  setDone(false);
  if(phase==='waiting'){setPosition(1.5);return;}
  let cancelled=false,animation=0,lastBoundary='';
  const complete=()=>{if(cancelled||completedKey.current===signature)return;completedKey.current=signature;setPosition(target);setDone(true);playExtraWin();if(!reduced)fireBattleCelebration();finish.current();};
  if(reduced){complete();return;}
  const started=performance.now(),duration=fast?1300:3400;
  const update=(now:number)=>{
   if(cancelled)return;
   const frame=playerStripFrame(ticket,result.total,now-started,duration);setPosition(frame.position);
   // Sounds follow presentation segment crossings; this does not choose or alter the result.
   const visualTicket=Math.min(result.total,Math.floor((frame.position-Math.floor(frame.position))*result.total)+1);
   const owner=result.ranges.find(range=>visualTicket>=range.startTicket&&visualTicket<=range.endTicket);
   const boundary=Math.floor(frame.position)+':'+(owner?.id||'');
   if(boundary!==lastBoundary&&frame.progress<1){playTick();lastBoundary=boundary;}
   if(frame.progress>=1){complete();return;}
   animation=requestAnimationFrame(update);
  };
  animation=requestAnimationFrame(update);
  return ()=>{cancelled=true;cancelAnimationFrame(animation);};
 },[phase,fast,reduced,signature]);
 const showWinner=phase==='complete'||done,verified=showWinner&&result.ok;
 const visiblePosition=showWinner?target:position;
 return <section className={styles.arena} data-battle-ticket-rng="strip-v2" aria-label="Battle jackpot player strip">
  <div className={styles.srOnly} role="status" aria-live="polite">{verified?'Jackpot winner drawn':phase==='revealing'?'Drawing jackpot winner…':'Preparing jackpot draw…'}</div>
  <div className={styles.pot}><span>JACKPOT</span><strong>{money(pot)}</strong></div>
  <div className={styles.stripFrame}>
   <span className={styles.pointerTop} aria-hidden="true"/>
   <div className={styles.viewport}>
    {result.ok?<div className={styles.track} data-player-strip="true" style={{'--cycles':PLAYER_STRIP_CYCLES,transform:`translate3d(${playerStripTranslation(visiblePosition)}%,0,0)`} as CSSProperties} aria-hidden="true">
     {Array.from({length:PLAYER_STRIP_CYCLES},(_,cycle)=><div className={styles.cycle} key={cycle} data-strip-cycle={cycle}>
      {result.ranges.map(range=><div key={range.id} className={styles.segment} data-participant-id={range.id} data-range-start={range.startTicket} data-range-end={range.endTicket} style={{width:((range.endTicket-range.startTicket+1)/result.total*100)+'%','--player-color':range.color} as CSSProperties}>
       <div className={styles.identity}><img src={range.avatar||'/assets/avatar/dummy.png'} alt="" width={34} height={34}/><strong>{range.label}</strong></div>
      </div>)}
     </div>)}
    </div>:<div className={styles.pending}>Waiting for the recorded jackpot result…</div>}
   </div>
   <span className={styles.pointerBottom} aria-hidden="true"/>
  </div>
  <footer className={styles.footer}>
   {verified?<p><span className={styles.winnerDot} style={{background:result.winner.color}}/>{result.winner.label} wins <small>Ticket #{ticket?.toLocaleString()}</small></p>:<p>{result.ok?'Player segment sizes match the server ticket shares.':'Waiting for server result.'}</p>}
   {verified&&onReplay&&<button type="button" onClick={onReplay}>Replay battle</button>}
  </footer>
  {!result.ok&&<div className={styles.unavailable}><p role="status">{result.message}</p><button type="button" onClick={onRefresh}>Refresh recorded result</button>{phase!=='complete'&&<button type="button" onClick={onFinished}>View recorded battle result</button>}</div>}
  <span className={styles.srOnly} aria-live="polite">{verified?`Recorded winning ticket ${ticket}. Winning participant ${result.winner.label}.`:'Waiting for the recorded jackpot result.'}</span>
 </section>;
}
