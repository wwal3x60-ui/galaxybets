/** Original synthesized audio. Cosmetic only: never selects or advances a result. */
export type SoundSettings = { enabled: boolean; volume: number };
const KEY = 'galaxybets-sound-v1';
let settings: SoundSettings = { enabled: true, volume: .35 };
let loaded = false, unlocked = false;
let context: AudioContext | null = null;
const listeners = new Set<() => void>();
const voices = new Set<OscillatorNode | AudioBufferSourceNode>();
const loops = new Set<() => void>();
let stopWheel: (() => void) | null = null;
let mineSequence = 0, kenoCue = 0;
export function getSoundSettings(): SoundSettings {
  if (!loaded && typeof window !== 'undefined') {
    loaded = true;
    try { const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (value && typeof value.enabled === 'boolean' && typeof value.volume === 'number' && Number.isFinite(value.volume))
        settings = { enabled: value.enabled, volume: Math.min(1, Math.max(0, value.volume)) };
    } catch {}
  }
  return settings;
}
function silence() {
  kenoCue++;
  for (const stop of [...loops]) stop(); stopWheel = null;
  for (const voice of voices) { try { voice.stop(); } catch {} } voices.clear();
}
export function setSoundSettings(value: Partial<SoundSettings>) {
  const previous = getSoundSettings(), volume = value.volume ?? previous.volume;
  settings = { enabled: value.enabled ?? previous.enabled, volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : previous.volume };
  if (!settings.enabled || settings.volume === 0) silence();
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch {}
  listeners.forEach(fn => fn());
}
export function subscribeSound(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function bindSoundStorage() {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === null) { loaded = false; getSoundSettings(); silence(); listeners.forEach(fn => fn()); } };
  const onVisibility = () => { if (document.hidden) silence(); };
  const onPageHide = () => silence();
  window.addEventListener('storage', onStorage); window.addEventListener('pagehide', onPageHide); document.addEventListener('visibilitychange', onVisibility);
  return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('pagehide', onPageHide); document.removeEventListener('visibilitychange', onVisibility); };
}
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioConstructor = window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext || AudioContext;
    if (!context || context.state === 'closed') context = new AudioConstructor();
    if (context.state === 'suspended') void context.resume().then(() => { unlocked = true; }).catch(() => {});
    unlocked = context.state === 'running';
  } catch {}
}
export async function ensureGameAudio(): Promise<boolean> {
  unlockAudio();
  let timer: ReturnType<typeof setTimeout>|undefined;
  try { if(context?.state==='suspended')await Promise.race([context.resume(),new Promise<void>(resolve=>{timer=setTimeout(resolve,1200);})]);unlocked=context?.state==='running';return unlocked; } catch { return false; } finally { if(timer)clearTimeout(timer); }
}
export function isAudioUnlocked() { return unlocked; }
function ready() {
  const pref = getSoundSettings();
  return pref.enabled && pref.volume > 0 && context?.state === 'running' && !(typeof document !== 'undefined' && document.hidden);
}
/** Bounded, enveloped voices keep transients soft and avoid overloaded audio. */
function tone(hz: number, delay: number, length: number, gain = .075, type: OscillatorType = 'sine', endHz = hz) {
  if (!ready() || !context || voices.size >= 32) return;
  try {
    const ctx = context, osc = ctx.createOscillator(), amp = ctx.createGain(), at = ctx.currentTime + delay;
    osc.type = type; osc.frequency.setValueAtTime(hz, at);
    if (endHz !== hz) osc.frequency.exponentialRampToValueAtTime(endHz, at + length);
    amp.gain.setValueAtTime(.0001, at); amp.gain.exponentialRampToValueAtTime(gain * getSoundSettings().volume, at + .008);
    amp.gain.exponentialRampToValueAtTime(.0001, at + length);
    osc.connect(amp); amp.connect(ctx.destination); voices.add(osc);
    osc.onended = () => { voices.delete(osc); osc.disconnect(); amp.disconnect(); };
    osc.start(at); osc.stop(at + length + .012);
  } catch { /* Audio hardware failure cannot interrupt a game. */ }
}
function noise(length: number, gain: number, cutoff: number) {
  if (!ready() || !context || voices.size >= 32) return;
  try {
    const ctx = context, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), amp = ctx.createGain();
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate), data = buffer.getChannelData(0);
    let seed = 91; // Audio-only noise, independent of all game randomness and seeds.
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = seed / 1073741823.5 - 1; }
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = cutoff;
    const at = ctx.currentTime; amp.gain.setValueAtTime(gain * getSoundSettings().volume, at); amp.gain.exponentialRampToValueAtTime(.0001, at + length);
    source.connect(filter); filter.connect(amp); amp.connect(ctx.destination); voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); amp.disconnect(); };
    source.start(at); source.stop(at + length);
  } catch {}
}
function chime(values: number[], step = .07, gain = .075) {
  values.forEach((hz, i) => { tone(hz, i * step, .29, gain); tone(hz * 2, i * step + .004, .13, gain * .18); });
}
export function playTick() { tone(420, 0, .025, .045, 'triangle', 290); noise(.018, .035, 1600); }
export function playBetAccepted() { tone(262, 0, .065, .065, 'triangle'); tone(392, .045, .1, .055); }
export function playBasicWin() { chime([659.25, 987.77], .048, .065); }
export function playSpecialWin() { chime([523.25, 659.25, 783.99, 1046.5], .065, .08); }
export function playExtraWin() { chime([523.25, 659.25, 783.99, 1046.5, 1318.5], .075, .08); }
export function playUpgradeFail() { tone(196, 0, .18, .075, 'triangle', 98); tone(147, .045, .2, .04); }
export function playAlertSuccess() { chime([659.25, 880], .045, .06); }
export function playSoundEffectError() { tone(220, 0, .09, .045, 'triangle'); tone(196, .08, .1, .045, 'triangle'); }
export function playMinesStart() { mineSequence = 0; playBetAccepted(); noise(.035, .035, 900); }
export function playMinesReveal() {
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5], note = scale[Math.min(mineSequence++, scale.length - 1)];
  tone(note, 0, .26, .085); tone(note * 1.5, .032, .18, .045); tone(note * 2, .06, .12, .018);
}
export function playMinesLoss() { noise(.24, .18, 650); tone(105, 0, .24, .1, 'sine', 45); tone(210, .02, .12, .035, 'triangle', 80); }
export function playMinesCashout() { chime([523.25, 659.25, 783.99, 1046.5], .065, .075); tone(261.63, 0, .35, .04); }
// Draws arrive 130ms apart. Each ball/hit cue ends before the next reveal.
function kenoAudio(play:()=>void){
 const cue=++kenoCue;if(ready()){play();return;}
 // Resume only an already gesture-created context. Do not autoplay on page load.
 if(context?.state==='suspended'&&getSoundSettings().enabled&&getSoundSettings().volume>0&&!(typeof document!=='undefined'&&document.hidden)){
  const at=Date.now();void context.resume().then(()=>{unlocked=context?.state==='running';if(cue===kenoCue&&Date.now()-at<120&&ready())play();}).catch(()=>{});
 }
}
export function playKenoBall() { kenoAudio(()=>{tone(520,0,.045,.115,'triangle',380);noise(.016,.05,1700);}); }
export function playKenoHit() { kenoAudio(()=>{tone(880,0,.09,.14);tone(1318.5,.018,.065,.055);}); }
export function playKenoResult() { kenoAudio(()=>{tone(523.25,0,.16,.11);tone(659.25,.045,.16,.095);tone(783.99,.09,.17,.085);}); }
export function playKenoMiss() { kenoAudio(()=>tone(330,0,.08,.08,'triangle',261.63)); }
export function playRouletteWin() { tone(293.66, 0, .25, .05); chime([587.33, 739.99, 880], .065, .07); }
export function playCoinflipLand() { noise(.045, .05, 2700); tone(1046.5, 0, .2, .055); tone(1568, .014, .12, .035); }
export function playJackpotWin() { chime([392, 523.25, 659.25, 783.99, 1046.5], .09, .075); tone(196, 0, .46, .045); }
function spin(duration: number, coin = false): () => void {
  if (!Number.isFinite(duration) || duration <= 0 || !ready()) return () => {};
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
  const started = Date.now();
  const stop = () => { stopped = true; if (timer) clearTimeout(timer); loops.delete(stop); };
  const tick = () => {
    const elapsed = Date.now() - started;
    if (stopped || elapsed >= duration || !ready()) { stop(); return; }
    if (coin) { tone(880, 0, .025, .028, 'triangle'); noise(.012, .022, 2400); } else playTick();
    timer = setTimeout(tick, (coin ? 70 : 55) + 250 * (elapsed / duration) ** 2);
  };
  loops.add(stop); tick(); return stop;
}
export function startSpinSound(duration: number): () => void { return spin(duration); }
export function startRouletteSound(duration: number): () => void { return spin(duration); }
export function startCoinflipSound(duration: number): () => void { return spin(duration, true); }
export function playWheelSpinning() { if (!stopWheel) stopWheel = startSpinSound(60000); }
export function stopWheelSpinning() { stopWheel?.(); stopWheel = null; }
export async function previewGameSound(game: string) {
  if(!await ensureGameAudio())return;
  if (game === 'mines') playMinesReveal(); else if (game === 'keno') playKenoHit(); else if (game === 'roulette') playRouletteWin(); else if (game === 'coinflip') playCoinflipLand(); else if (game === 'jackpot') playJackpotWin(); else playBasicWin();
}
