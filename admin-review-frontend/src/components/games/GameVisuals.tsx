"use client";

import { useId, type CSSProperties } from 'react';
import styles from './GameVisuals.module.css';

export type GameName = 'mines' | 'keno' | 'roulette' | 'jackpot' | 'coinflip' | 'battles';

export function Gem({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className={className}>
    <defs><linearGradient id={id} x1="13" y1="12" x2="65" y2="72" gradientUnits="userSpaceOnUse"><stop stopColor="#d8fff7"/><stop offset=".36" stopColor="#52eac1"/><stop offset="1" stopColor="#087663"/></linearGradient></defs>
    <path d="m21 14 38 0 14 22-33 34L7 36l14-22Z" fill={`url(#${id})`} stroke="#d4fff1" strokeWidth="1.5"/>
    <path d="m21 14 19 56-5-34-14-22Z" fill="#d6fff5" fillOpacity=".6"/><path d="m59 14-19 56 5-34 14-22Z" fill="#006b63" fillOpacity=".7"/>
    <path d="M7 36h66L59 14 45 36H35L21 14 7 36Z" fill="#b6ffe5" fillOpacity=".45"/><path d="m35 36 5-22 5 22-5 34-5-34Z" fill="#5cebc5"/>
    <path d="m21 14 14 22h10l14-22M7 36h66M40 14v56" stroke="#effff9" strokeOpacity=".4" strokeWidth="1"/>
    <path d="m20 21 3 8 8 3-8 2-3 8-2-8-8-2 8-3 2-8Z" fill="#fff" fillOpacity=".9"/>
  </svg>;
}

export function Mine({ className = '' }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className={className}>
    <defs><radialGradient id={id} cx=".33" cy=".22" r=".82"><stop stopColor="#7b7b80"/><stop offset=".43" stopColor="#3b3c40"/><stop offset="1" stopColor="#101115"/></radialGradient></defs>
    <path d="m49 24 7-10 6 1 2-5" stroke="#c99262" strokeWidth="4" strokeLinecap="round"/>
    <path d="m57 9 6 1 5-5M68 15l5-1M66 3V0" stroke="#ffc592" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="m42 23 8 5 4-7-8-5-4 7Z" fill="#a6a6ab" stroke="#d4d8e1"/>
    <circle cx="36" cy="47" r="25" fill={`url(#${id})`} stroke="#9a9a9f" strokeWidth="1.2"/>
    <path d="M19 44a19 19 0 0 1 18-16" stroke="#e5edf5" strokeWidth="3" strokeLinecap="round" strokeOpacity=".65"/>
    <path d="M21 62a23 23 0 0 0 29-3" stroke="#000" strokeOpacity=".4" strokeWidth="4"/>
    <path d="m31 42 10 10m0-10L31 52" stroke="#f09592" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>;
}

export function MinesTileFace({ state, pending, hit }: { state: 'hidden' | 'safe' | 'mine' | 'unpicked'; pending: boolean; hit: boolean }) {
  return <span className={`${styles.tileFace} ${state === 'safe' ? styles.revealed : ''} ${hit ? styles.explosion : ''}`}>
    {pending ? <span className={styles.loader}/> : state === 'hidden' ? <svg className="crMineSeal" viewBox="0 0 48 48" fill="none"><path d="m10 33 10-19m0 19 10-19m0 19 10-19" stroke="currentColor" strokeWidth="4"/></svg> : state === 'mine' ? <img src="/assets/crimson/symbols/mines-bomb.png" width={128} height={128} alt="" className={styles.mine}/> : <img src="/assets/crimson/symbols/mines-gem.png" width={128} height={128} alt="" className={state === 'unpicked' ? styles.unpicked : styles.gem}/>}
    {!pending && (state === 'safe' || hit) && <span className={styles.particles}>{Array.from({ length: 6 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties}/>)}</span>}
  </span>;
}

export function GameCoin({ side, small = false }: { side: 'fire' | 'ice'; small?: boolean }) {
  const id = useId().replace(/:/g, '');
  const fire = side === 'fire';
  return <svg viewBox="0 0 100 100" fill="none" aria-hidden="true" className={small ? styles.smallToken : styles.coin}>
    <defs><linearGradient id={id} x1="18" y1="6" x2="82" y2="95" gradientUnits="userSpaceOnUse"><stop stopColor={fire ? '#ffc5c8' : '#fafaff'}/><stop offset=".32" stopColor={fire ? '#e64454' : '#afb2bb'}/><stop offset=".55" stopColor={fire ? '#ffa0a8' : '#fafaff'}/><stop offset="1" stopColor={fire ? '#7e1725' : '#737782'}/></linearGradient></defs>
    <circle cx="50" cy="52" r="46" fill={fire ? '#6d391c' : '#636468'}/><circle cx="50" cy="48" r="45" fill={`url(#${id})`} stroke={fire ? '#ffc5cf' : '#c5efff'} strokeWidth="1.5"/>
    <circle cx="50" cy="48" r="40" stroke={fire ? '#8f293d' : '#5d9ebf'} strokeWidth="3" strokeDasharray="1.8 3.5"/>
    <circle cx="50" cy="48" r="35" fill={fire ? '#3a1824' : '#172c3f'} stroke={fire ? '#ed7287' : '#a7d9fa'} strokeWidth="1.2"/>
    <circle cx="50" cy="48" r="31" stroke={fire ? '#b7415b' : '#6ba6cc'} strokeWidth=".8"/>
    {fire ? <><path d="M53 24c3 13-13 19-8 30 4-3 7-7 7-11 13 7 17 18 9 27-10 12-29 5-29-9 0-14 15-21 21-37Z" fill={`url(#${id})`}/><path d="M52 53c0 8-10 11-7 17 3 5 10 2 11-3 1-4-1-9-4-14Z" fill="#fff2bc"/></> : <g stroke="#efeff4" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M50 26v44M31 37l38 22M31 59l38-22M44 30l6 6 6-6M44 66l6-6 6 6M33 44l8-2-2-8M61 62l-2-8 8-2M33 52l8 2-2 8M61 34l-2 8 8 2"/><path d="m50 42 6 6-6 6-6-6 6-6Z" fill="#8fdbff"/></g>}
    <path d="M21 25a38 38 0 0 1 56-2" stroke="#fff" strokeOpacity=".55" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>;
}

export function RouletteToken({ color, small = false, specialColor = 2 }: { color: 0 | 1 | 2 | 3; small?: boolean; specialColor?: 1 | 2 }) {
  const name = ['gold','green','red','special'][color];
  if (color === 3) return <span aria-hidden="true" data-color={specialColor} className={`crRune crRuneSpecial ${small?'crRuneSmall':''}`}><img src={`/assets/crimson/symbols/roulette-dragon-${specialColor===1?'green':'red'}.png`} width={128} height={128} alt=""/></span>;
  return <span aria-hidden="true" className={`crRune ${small?'crRuneSmall':''}`}><img src={`/assets/crimson/symbols/roulette-${name}.png`} width={128} height={128} alt=""/></span>;
}

export function GameEmblem({ game }: { game: GameName }) {
  return <span className={styles.emblem} data-game={game} aria-hidden="true">{game === 'mines' ? <Gem/> : game === 'coinflip' ? <GameCoin side="fire"/> : game === 'roulette' ? <RouletteToken color={3}/> : <svg viewBox="0 0 40 40" fill="none">{game === 'keno' ? <><rect x="6" y="6" width="28" height="28" rx="8" stroke="currentColor" strokeWidth="1.5"/>{[14,25].map(x=>[14,25].map(y=><circle key={x+','+y} cx={x} cy={y} r="3" fill="currentColor"/>))}</> : game === 'jackpot' ? <><circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.5"/><circle cx="20" cy="20" r="6" stroke="currentColor"/><path d="M20 6v8m0 12v8M6 20h8m12 0h8M10 10l6 6m8 8 6 6M10 30l6-6m8-8 6-6" stroke="currentColor"/></> : <><path d="m10 7 19 23m1-23L11 30M7 25l8 8m10 0 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><path d="m8 5 5 2-4 4-1-6Zm24 0-5 2 4 4 1-6Z" fill="currentColor"/></>}</svg>}</span>;
}

/** Decorative previews use the same artwork as the playable boards. No live data is implied. */
export function GameScene({ game }: { game: GameName }) {
  return <div className={styles.scene} data-game={game} aria-hidden="true">
    {game === 'mines' ? <div className={styles.miniMines}>{Array.from({ length: 9 }, (_, i) => <span key={i} data-open={i === 1 || i === 4 || i === 6}>{i === 1 || i === 4 || i === 6 ? <Gem/> : <i/>}</span>)}</div> : game === 'keno' ? <div className={styles.miniKeno}>{Array.from({ length: 12 }, (_, i) => <span key={i} data-picked={[1,4,6,9].includes(i)}>{i + 1}</span>)}</div> : game === 'roulette' ? <div className={styles.miniReel}><RouletteToken color={2}/><RouletteToken color={0}/><RouletteToken color={1}/></div> : game === 'coinflip' ? <div className={styles.miniCoins}><GameCoin side="fire"/><GameCoin side="ice"/></div> : game === 'jackpot' ? <div className={styles.miniWheel}><span><svg viewBox="0 0 40 40"><path d="m20 7 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1 4-8Z" fill="#ddc391"/></svg></span></div> : <div className={styles.miniBattle}><GameCoin side="fire"/><b>VS</b><GameCoin side="ice"/></div>}
  </div>;
}
