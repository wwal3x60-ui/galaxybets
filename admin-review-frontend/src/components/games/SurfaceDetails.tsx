import type { PackDetails } from '@/lib/api/packs';
export {default as KenoAudioTools} from './KenoAudioTools';

export function BattleBuildSteps({count}:{count:number}){
 return <div className="gxBuildSteps" aria-label="Battle setup"><span data-complete={count>0}><b>1</b> Select cases <em>{count} selected</em></span><i/><span><b>2</b> Seats & rules</span><i/><span><b>3</b> Create battle</span></div>;
}
export function BattleSeats({players,team,funding}:{players:number;team:boolean;funding:number}){
 return <div className="gxBattlePreview"><div className="gxSeatStage" aria-label={`${players} player seats${team?', in teams':''}`}>{Array.from({length:players},(_,i)=><span key={i} data-creator={i===0} data-team={team?i<2?'one':i<4?'two':'three':undefined}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/></svg><b>P{i+1}</b>{i===0&&<small>You</small>}</span>)}</div><p>{team?'Compete with your team.':'Every player for themselves.'}</p>{funding>0&&<span className="gxFundingBadge">{funding}% of other seats funded</span>}</div>;
}
export function PackOpeningTitle({packs,fast}:{packs:PackDetails[];fast:boolean}){
 return <header className="gxPackTitle"><div><p>GALAXYBETS · CASE OPENING</p><h1>{packs.length===1?packs[0].name:packs.length?'Your case lineup':'Case opening'}</h1><span>The selected drop stops at the centre marker.</span></div><span className="gxOpeningMode">{fast?'Fast opening':'Standard opening'}</span></header>;
}
export function PackDisplayPrice({value}:{value:unknown}){
 const price=Number(String(value??'').replace(/[^0-9.-]/g,''));
 return <span className="gxPickerPrice">{Number.isFinite(price)?price.toLocaleString('en-US',{style:'currency',currency:'USD'}):'Price unavailable'}</span>;
}
