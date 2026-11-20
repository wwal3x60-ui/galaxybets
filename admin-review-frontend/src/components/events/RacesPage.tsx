'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getRace, type RaceSnapshot, type RaceType } from '@/lib/api/races';
import styles from './RacesPage.module.css';
import { profileAvatarUrl } from '@/lib/api/profile-photo';
const money = (value: string | number) => Number(value || 0).toLocaleString('en-US', {style:'currency', currency:'USD', maximumFractionDigits:2});
const integer = (value: number) => String(value).padStart(2,'0');
const choices: {type:RaceType;name:string;pool:string}[] = [
  {type:'weekly',name:'Weekly Race',pool:'500'}, {type:'monthly',name:'Monthly Race',pool:'10000'},
];
function remaining(snapshot:RaceSnapshot|null, now:number) {
  return snapshot ? Math.max(0, snapshot.remainingAtReceipt - (now-snapshot.receivedAt)) : 0;
}
function clockParts(ms:number) {
  const seconds=Math.floor(ms/1000);
  return [Math.floor(seconds/86400), Math.floor(seconds%86400/3600), Math.floor(seconds%3600/60), seconds%60];
}
function PlayerAvatar({id, name, small = false}: {id?: string; name?: string; small?: boolean}) {
  const imageUrl = useMemo(() => id && name !== 'Anonymous' ? profileAvatarUrl(id) : null, [id, name]);
  return <span className={`${styles.playerAvatar} ${small ? styles.tableAvatar : ''}`} aria-hidden="true">
    <span>{name ? name.charAt(0).toUpperCase() : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20v-1.5a6.5 6.5 0 0 1 13 0V20" strokeLinecap="round"/></svg>}</span>
    {imageUrl && <img key={imageUrl} src={imageUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />}
  </span>;
}
export default function RacesPage() {
  const [type,setType]=useState<RaceType>('weekly');
  const [snapshots,setSnapshots]=useState<Partial<Record<RaceType,RaceSnapshot>>>({});
  const [errors,setErrors]=useState<Partial<Record<RaceType,string>>>({});
  const [loading,setLoading]=useState(false);
  const [now,setNow]=useState(0);
  const [retry,setRetry]=useState(0);
  const requests=useRef(0);
  useEffect(()=>{
    const tick=()=>setNow(performance.now());tick();
    const timer=window.setInterval(tick,250);return ()=>window.clearInterval(timer);
  },[]);
  useEffect(()=>{
    const id=++requests.current;
    let stopped=false, running=false;
    const controller=new AbortController();
    async function refresh() {
      if(stopped||running)return;
      running=true;setLoading(true);
      try {
        const value=await getRace(type,controller.signal);
        if(stopped||requests.current!==id)return;
        setNow(performance.now());
        setSnapshots(previous=>({...previous,[type]:value}));
        setErrors(previous=>({...previous,[type]:undefined}));
      }catch(error){
        if(!stopped&&requests.current===id)setErrors(previous=>({...previous,[type]:error instanceof Error?error.message:'Race data is unavailable. Please retry.'}));
      }finally{running=false;if(!stopped)setLoading(false);}
    }
    void refresh();
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},10000);
    const onVisible=()=>{if(!document.hidden)void refresh();};
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{stopped=true;controller.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',onVisible);};
  },[type,retry]);
  const snapshot=snapshots[type]??null;
  const race=snapshot?.data;
  const error=errors[type];
  const ms=remaining(snapshot,now);
  const expired=!!race&&ms<=0;
  const labels=['Days','Hours','Minutes','Seconds'];
  const prizes=race?.prizes??(type==='weekly'?['300','150','50']:['6000','3000','1000']);
  return (
    <main className={styles.page}>
      <div className={styles.tabs} role="tablist" aria-label="Race period">
        {choices.map(choice=><button key={choice.type} role="tab" tabIndex={type===choice.type?0:-1} onKeyDown={event=>{
          if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
          event.preventDefault();
          const next=event.key==='Home'?'weekly':event.key==='End'?'monthly':type==='weekly'?'monthly':'weekly';
          setType(next);document.getElementById(`tab-${next}`)?.focus();
        }} aria-selected={type===choice.type} aria-controls="race-panel" id={`tab-${choice.type}`} onClick={()=>setType(choice.type)} className={type===choice.type?styles.active:''}>
          {choice.name}<span className={styles.tabPool}>{money(choice.pool)}</span>
        </button>)}
      </div>
      <section role="tabpanel" id="race-panel" aria-labelledby={`tab-${type}`}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>Events</span>
          <h1><span>{type==='weekly'?'$500':'$10,000'}</span> {type==='weekly'?'Weekly':'Monthly'} Race</h1>
          <p>Top 3 players win. Ranked by completed wagers.</p>
          <div className={styles.countdownBlock}>
            <span className={styles.countdownLabel}>{!race?'Loading countdown':expired||race.status==='catching_up'?'Finalizing results':'Ends in'}</span>
            <div className={styles.countdown} role="timer" aria-label="Time remaining" aria-live="off">
              {clockParts(ms).map((value,index)=><div key={labels[index]}><strong>{race?integer(value):'—'}</strong><span>{labels[index]}</span></div>)}
            </div>
            <span className={styles.deadline}>{race?`Round #${race.roundNumber} · Ends ${new Date(race.endsAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'})}`:'Loading the saved race deadline…'}</span>
          </div>
        </header>
        {error&&<div className={styles.error} role="alert"><span>{race?'Standings may be out of date. ':''}{error}</span><button onClick={()=>setRetry(value=>value+1)} disabled={loading}>Retry</button></div>}
        <section className={styles.prizes} aria-label="Top three prizes">
          {[0,1,2].map(index=>{
            const player=race?.users[index];
            return <article className={`${styles.prizeCard} ${styles[`place${index+1}`]}`} key={index} aria-label={`Rank ${index+1} prize`}>
              <div className={styles.podiumHeading}>
                <span className={styles.rankMark}>#{index+1}</span>
                <span className={styles.prizeLabel}>{['First place','Second place','Third place'][index]}</span>
              </div>
              <div className={styles.podiumPlayer}>
                <PlayerAvatar key={player?.id ?? 'empty'} id={player?.id} name={player?.username} />
                <div className={styles.podiumIdentity}>
                  <h2>{player?.username ?? 'Open position'}</h2>
                  <p>{player ? `${money(player.wagered)} wagered` : 'No qualifying wagers yet'}</p>
                </div>
              </div>
              <div className={styles.prizeFooter}>
                <span className={styles.prizeCaption}>Prize payout</span>
                <strong className={styles.prizeAmount}>{money(prizes[index])}</strong>
              </div>
            </article>;
          })}
        </section>
        <section className={styles.board}>
          <div className={styles.boardHeading}><div><h2>Leaderboard</h2><p>Standings update every 10 seconds.</p></div><button onClick={()=>setRetry(value=>value+1)} disabled={loading}>{loading?'Refreshing…':'Refresh standings'}</button></div>
          <div className={styles.tableScroll}><table><thead><tr><th>Rank</th><th>Player</th><th>Completed wagers</th><th>Prize</th></tr></thead>
            <tbody>{race?.users.map(player=><tr key={player.id}><td><span className={player.position<=3?styles.topRank:styles.otherRank}>#{player.position}</span></td><td><div className={styles.tablePlayer}><PlayerAvatar id={player.id} name={player.username} small /><span>{player.username}</span></div></td><td>{money(player.wagered)}</td><td className={player.position<=3?styles.reward:''}>{player.position<=3?money(player.reward):'—'}</td></tr>)}</tbody>
          </table></div>
          {!race?<p className={styles.empty} role="status">{error?'Standings could not be loaded. Use Retry above.':'Loading live standings…'}</p>:race.users.length===0?<div className={styles.empty}><strong>No eligible wagers yet</strong><p>Complete a wager to enter. The top 3 players share the prize pool.</p></div>:null}
          <p className={styles.updated}>{race?`Last updated ${new Date(race.serverNow).toLocaleTimeString()} · Top 50 players`:'Waiting for the backend'}</p>
        </section>
        {!!race?.previousWinners.length&&<section className={styles.history}><h2>Previous race winners</h2><div>{race.previousWinners.map(player=><article key={player.id}><span>#{player.position} · {player.username}</span><strong>{money(player.reward)}</strong></article>)}</div></section>}
        <details className={styles.rules}><summary>Race rules</summary><div><p><b>Climb the leaderboard.</b> Your completed, positive wagers during each race count toward your total. The same eligible wager can count in both races.</p><p><b>Top 3 win.</b> Prizes are credited to site balances after each race is finalized. Empty positions are not paid. Bots, staff, banned and leaderboard-excluded accounts are ineligible.</p><p><b>A fixed finish line.</b> Deadlines are saved on the server. The first weekly race lasts 7 days 12 hours, then repeats every 7 days. Monthly races repeat by calendar month from launch. Ties go to the player with the earlier first qualifying bet, then the lower user ID.</p></div></details>
      </section>
    </main>
  );
}
