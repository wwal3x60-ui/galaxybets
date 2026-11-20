"use client";
import {useState,useSyncExternalStore} from 'react';
import {useSoundPreference} from '@/hooks/useSoundPreference';
import {getSoundSettings,subscribeSound,setSoundSettings,ensureGameAudio,playKenoResult} from '@/lib/audio';
export default function KenoAudioTools(){
 const [enabled,setEnabled]=useSoundPreference(),[message,setMessage]=useState('');
 const volume=useSyncExternalStore(subscribeSound,()=>getSoundSettings().volume,()=>.35);
 const test=async()=>{setMessage('');if(!enabled)setEnabled(true);if(volume===0)setSoundSettings({volume:.35});const ready=await ensureGameAudio();if(ready){playKenoResult();setMessage('Test played. If silent, check the tab and device volume.');}else setMessage('Audio is blocked. Click again or check your browser sound permission.');};
 return <div className="gxKenoAudio"><div><button type="button" aria-pressed={enabled} onClick={()=>setEnabled(v=>!v)}>Sound <strong>{enabled?'On':'Off'}</strong></button><button type="button" onClick={()=>void test()}>{enabled&&volume>0?'Test sound':'Enable & test'}</button></div><label>Volume · {Math.round(volume*100)}%<input aria-label="Keno volume" type="range" min="0" max="100" step="5" value={Math.round(volume*100)} onChange={e=>{void ensureGameAudio();setSoundSettings({volume:Number(e.target.value)/100});}}/></label>{message&&<p role="status">{message}</p>}</div>;
}
