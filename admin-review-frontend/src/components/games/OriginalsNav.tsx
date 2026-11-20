import Link from 'next/link';
const games = [{id:'mines',label:'Mines',path:'m12 3 9 7-9 11L3 10l9-7Zm-9 7h18M8 6l4 15 4-15'},{id:'roulette',label:'Roulette',path:'M12 3a9 9 0 1 0 9 9M12 7v5l4 4M17 3h4v4'},{id:'coinflip',label:'Coinflip',path:'M15 12a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-3-6a6 6 0 1 1 0 12M9 9v6'},{id:'jackpot',label:'Jackpot',path:'m4 8 4 4 4-7 4 7 4-4-2 12H6L4 8ZM7 16h10'},{id:'upgrader',label:'Upgrader',path:'m4 14 8-8 8 8M4 20l8-8 8 8'}];
export default function OriginalsNav({active}:{active:string}) {
  return <nav className="crOriginalsNav" aria-label="Original games">{games.map(game=><Link key={game.id} href={game.id==='upgrader'?'/review/upgrader':`/${game.id}`} aria-current={active===game.id?'page':undefined}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={game.path} strokeLinecap="round" strokeLinejoin="round"/></svg>{game.label}{game.id==='upgrader'&&<small>Preview</small>}</Link>)}</nav>;
}
