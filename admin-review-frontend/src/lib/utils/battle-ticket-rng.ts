export type TicketRange={id:string;label:string;color:string;avatar?:string;startTicket:number;endTicket:number};
export type TicketResult={ok:true;total:number;winner:TicketRange;ranges:TicketRange[]}|{ok:false;message:string};
export function canStartBattleTicketReveal(state:{mode:string;status:string;replaying:boolean;finished:boolean;started:boolean;packsRevealed:boolean;ticket?:number;rangeCount:number;startedAsCompleted:boolean;playbackJustEnded:boolean}){
 return state.mode==='JACKPOT'&&state.status==='completed'&&!state.replaying&&!state.finished&&!state.started&&state.packsRevealed&&state.ticket!==undefined&&state.rangeCount>0&&(!state.startedAsCompleted||state.playbackJustEnded);
}
/** Validate the server's recorded result. This helper never draws a ticket or chooses a new winner. */
export function validateBattleTicket(ranges:TicketRange[],ticket:number|undefined,winnerId:string|null):TicketResult{
 if(!Array.isArray(ranges)||ranges.length===0||ticket===undefined)return {ok:false,message:'Waiting for the recorded ticket and ticket ranges.'};
 if(!Number.isSafeInteger(ticket)||ticket<1)return {ok:false,message:'The recorded ticket could not be verified.'};
 const ordered=ranges.slice().sort((a,b)=>a.startTicket-b.startTicket),ids=new Set<string>();let next=1;
 for(const range of ordered){if(!range.id||ids.has(range.id)||!Number.isSafeInteger(range.startTicket)||!Number.isSafeInteger(range.endTicket)||range.startTicket!==next||range.endTicket<range.startTicket)return {ok:false,message:'The recorded ticket ranges could not be verified.'};ids.add(range.id);next=range.endTicket+1;}
 const total=next-1;if(ticket>total)return {ok:false,message:'The recorded ticket is outside the server ticket ranges.'};
 const winner=ordered.find(r=>ticket>=r.startTicket&&ticket<=r.endTicket);
 if(!winner||!winnerId||winner.id!==winnerId)return {ok:false,message:'The recorded winner and ticket do not match. Refresh the battle to load the latest result.'};
 return {ok:true,total,winner,ranges:ordered};
}
/** Decorative digit reveal only; the final value always equals the supplied server ticket. */
export function ticketRevealFrame(ticket:number,total:number,elapsed:number,duration:number){
 const progress=Math.max(0,Math.min(1,duration>0?elapsed/duration:1));
 const target=String(ticket).padStart(Math.max(6,String(total).length),'0');
 const locked=progress===1?target.length:Math.min(target.length-1,Math.floor(progress*target.length));
 const phase=Math.floor(Math.max(0,elapsed)/45);
 return {progress,locked,digits:Array.from(target,(digit,index)=>index<locked?digit:String((phase+index*3)%10)).join('')};
}
export const PLAYER_STRIP_CYCLES=9;
export const PLAYER_STRIP_FINAL_CYCLE=6;
/** A strip cycle contains the actual server ranges, with widths proportional to their ticket counts. */
export function playerStripLanding(ticket:number,total:number){
 if(!Number.isSafeInteger(ticket)||!Number.isSafeInteger(total)||ticket<1||ticket>total)throw Error('Invalid recorded ticket.');
 return PLAYER_STRIP_FINAL_CYCLE+(ticket-.5)/total;
}
export function playerStripTranslation(position:number){return (0.5-position)/PLAYER_STRIP_CYCLES*100;}
export function playerStripFrame(ticket:number,total:number,elapsed:number,duration:number){
 const progress=Math.max(0,Math.min(1,duration>0?elapsed/duration:1)),start=1.5,target=playerStripLanding(ticket,total);
 const position=progress>=1?target:start+(target-start)*(1-Math.pow(1-progress,4));
 return {progress,position,translatePercent:playerStripTranslation(position)};
}
