"use client";
import { useEffect, useSyncExternalStore } from 'react';
import { bindSoundStorage, getSoundSettings, setSoundSettings, subscribeSound, unlockAudio, previewGameSound } from '@/lib/audio';
import { useSoundPreference } from '@/hooks/useSoundPreference';
export default function GameSoundControl() {
 const [enabled,setEnabled]=useSoundPreference();
 const volume=useSyncExternalStore(subscribeSound,()=>getSoundSettings().volume,()=>.35);
 useEffect(()=>{
  const release=bindSoundStorage(),unlock=()=>unlockAudio();
  document.addEventListener('pointerdown',unlock);document.addEventListener('keydown',unlock);
  return()=>{release();document.removeEventListener('pointerdown',unlock);document.removeEventListener('keydown',unlock);};
 },[]);
 return <details className="gxSoundControl relative text-white"><summary aria-label="Game sound settings" className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full border border-white/10 bg-highlight focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M11 5 6 9H3v6h3l5 4V5Z"/>{enabled&&volume>0?<><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></>:<path d="m16 9 6 6m0-6-6 6"/>}</svg></summary>
  <div className="gxSoundPopover absolute right-0 top-11 z-50 w-64 rounded-xl border border-white/10 bg-[#1a1b1f] p-4 shadow-xl">
   <div className="gxSoundHeading"><strong>Game audio</strong><span>Original sound set</span></div>
   <button type="button" aria-pressed={enabled} onClick={()=>setEnabled(v=>!v)} className="gxSoundToggle">Sound <span>{enabled?'On':'Off'}</span></button>
   <label className="flex flex-col gap-2 text-xs">Volume · {Math.round(volume*100)}%<input aria-label="Game sound volume" type="range" min="0" max="100" step="5" value={Math.round(volume*100)} onChange={e=>{unlockAudio();setSoundSettings({volume:Number(e.target.value)/100});}} className="w-full accent-violet-400"/></label>
   <p className="gxSoundPreviewLabel">Preview a sound</p><div className="gxSoundPreviews">{['mines','roulette','coinflip','keno','jackpot'].map(game=><button key={game} type="button" disabled={!enabled||volume===0} onClick={()=>void previewGameSound(game)} aria-label={`Preview ${game} sound`}>{game}</button>)}</div>
  </div>
 </details>;
}
