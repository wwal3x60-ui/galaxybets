'use strict';
const fail=message=>{throw new Error(message);};
function cents(value){if(typeof value==='number'){if(!Number.isFinite(value)||value<0||!Number.isSafeInteger(Math.round(value*100))||Math.abs(value*100-Math.round(value*100))>1e-5)fail('INVALID_MONEY');return BigInt(Math.round(value*100));}const s=String(value);if(!/^\d+(?:\.\d{1,2})?$/.test(s))fail('INVALID_MONEY');const[a,b='']=s.split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'));}
const decimal=n=>(n/100n).toString()+'.'+(n%100n).toString().padStart(2,'0');
const id=value=>{if(typeof value==='number'&&!Number.isSafeInteger(value))fail('UNSAFE_ID');const s=String(value);if(!/^[1-9]\d*$/.test(s))fail('INVALID_ID');return s;};
function plan({battle,bets,players,funding,rounds,quote}){
 const battleId=id(battle.id),owner=id(battle.ownerId);if(battle.endedAt||battle.cancelledAt)fail('ALREADY_CLOSED');if(battle.winnerTeam!=null&&Number(battle.winnerTeam)!==0)fail('WINNER_ALREADY_RECORDED');
 if(!rounds.length)fail('MISSING_ROUND_PRICES');const base=rounds.reduce((n,r)=>n+cents(r.priceUsd),0n);if(base>BigInt(Number.MAX_SAFE_INTEGER))fail('UNSAFE_PRICE');
 const slots=Number(battle.teams)*Number(battle.playersPerTeam);if(!Number.isSafeInteger(slots)||slots<2||slots>8)fail('INVALID_SEATS');
 const q=quote(Number(base)/100,slots,Number(battle.ownerFunding));for(const key of ['cost','creatorStake','sponsorPaid','entryPrice'])cents(q[key]);
 if(cents(q.entryPrice)!==cents(battle.entryPrice)||cents(q.sponsorPaid)!==cents(battle.sponsorPaid)||Boolean(q.sponsorOnly)!==Boolean(Number(battle.sponsorOnly)))fail('STORED_QUOTE_MISMATCH');
 if(cents(q.cost)!==cents(q.creatorStake)+cents(q.sponsorPaid))fail('UNSUPPORTED_FUNDING_ACCOUNTING');
 const paidFunding=funding.reduce((n,t)=>{if(id(t.userId)!==owner)fail('FUNDING_OWNER_MISMATCH');return n+cents(t.amount);},0n);if(paidFunding!==cents(q.sponsorPaid))fail('FUNDING_LEDGER_MISMATCH');
 const entries=new Map();for(const p of players){const uid=id(p.userId);if(entries.has(uid))fail('DUPLICATE_PLAYER');entries.set(uid,p);}
 const stakes=new Map();for(const b of bets){const uid=id(b.userId);if(Number(b.completed)!==0||cents(b.winnings||0)!==0n)fail('SETTLEMENT_ALREADY_RECORDED');if(stakes.has(uid)||!entries.has(uid))fail('AMBIGUOUS_ENTRY');stakes.set(uid,cents(b.amount));}
 if(entries.size!==stakes.size)fail('MISSING_ENTRY_LEDGER');if((stakes.get(owner)||0n)!==cents(q.creatorStake))fail('CREATOR_STAKE_MISMATCH');
 if(q.sponsorOnly&&entries.has(owner))fail('SPONSOR_SEAT_MISMATCH');
 const refunds=new Map([[owner,cents(q.cost)]]);
 for(const[uid,stake]of stakes){if(uid===owner)continue;if(stake!==cents(battle.entryPrice))fail('PLAYER_STAKE_MISMATCH');const bot=String(entries.get(uid).role).toUpperCase()==='BOT';if(!bot||battle.gamemode==='jackpot')refunds.set(uid,stake);}
 return{battleId,owner,refunds:[...refunds].filter(([,amount])=>amount>0n).map(([userId,amount])=>({userId,amount:decimal(amount)}))};
}
async function settle(c,battleId,quote){
 await c.beginTransaction();try{
 const[[battle]]=await c.query('SELECT * FROM battles WHERE id=? FOR UPDATE',[battleId]);if(!battle||battle.endedAt||battle.cancelledAt){await c.rollback();return{skipped:true};}
 const[existing]=await c.query('SELECT battleId FROM legacyBattleRetirements WHERE battleId=?',[battleId]);if(existing.length)fail('RETIREMENT_STATE_MISMATCH');
 const[bets]=await c.query("SELECT userId,CAST(amount AS CHAR) amount,completed,CAST(COALESCE(winnings,0) AS CHAR) winnings FROM bets WHERE game='battle' AND gameId=? ORDER BY id FOR UPDATE",[battleId]);
 const[players]=await c.query('SELECT p.userId,u.role FROM battlePlayers p INNER JOIN users u ON u.id=p.userId WHERE p.battleId=? ORDER BY p.userId',[battleId]);
 const[funding]=await c.query("SELECT userId,CAST(amount AS CHAR) amount FROM transactions WHERE method='battle_funding' AND methodId=? AND type='out' AND status='approved' FOR UPDATE",[String(battleId)]);
 const[rounds]=await c.query('SELECT CAST(v.price/100 AS DECIMAL(18,2)) priceUsd FROM battleRounds r INNER JOIN caseVersions v ON v.id=r.caseVersionId WHERE r.battleId=? ORDER BY r.round',[battleId]);
 const result=plan({battle,bets,players,funding,rounds,quote});
 const ids=result.refunds.map(r=>r.userId).sort((a,b)=>BigInt(a)<BigInt(b)?-1:1);
 for(const userId of ids){const[[user]]=await c.query('SELECT id FROM users WHERE id=? FOR UPDATE',[userId]);if(!user)fail('REFUND_USER_MISSING');}
 await c.query('INSERT INTO legacyBattleRetirements(battleId,ownerId) VALUES(?,?)',[result.battleId,result.owner]);
 for(const refund of result.refunds){await c.query('INSERT INTO legacyBattleRefunds(battleId,userId,amount) VALUES(?,?,?)',[result.battleId,refund.userId,refund.amount]);await c.query('UPDATE users SET balance=balance+? WHERE id=?',[refund.amount,refund.userId]);await c.query("INSERT INTO transactions(userId,amount,type,method,methodId,status) VALUES(?,?,'in','battle_retirement',?,'approved')",[refund.userId,refund.amount,'retire-v1:'+result.battleId+':'+refund.userId]);}
 const[closed]=await c.query('UPDATE battles SET cancelledAt=NOW(),endedAt=NOW() WHERE id=? AND cancelledAt IS NULL AND endedAt IS NULL',[result.battleId]);if(closed.affectedRows!==1)fail('CANCELLATION_RACE');
 await c.commit();return result;
 }catch(error){await c.rollback().catch(()=>{});throw error;}
}
module.exports={cents,decimal,plan,settle};
