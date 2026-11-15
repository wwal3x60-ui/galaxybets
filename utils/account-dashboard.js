'use strict';
const {cents,decimal,GAMES}=require('./wager-rewards');
const VERSION='galaxy-account-v1';
const zero='0.00';
const remaining=(required,progress)=>cents(required)>cents(progress)?cents(required)-cents(progress):0n;
const signed=n=>n<0n?'-'+decimal(-n):decimal(n);
function progress(required,left){const target=cents(required),rest=cents(left)>target?target:cents(left);return{required,remaining:decimal(rest),completed:decimal(target-rest),percent:target===0n?100:Number((target-rest)*10000n/target)/100};}
function createDashboard({sql,profiles,rewards,bonus,tipWagering}){
 async function get(userId){
  const [[user]]=await sql.query("SELECT CAST(balance AS CHAR) AS balance,CAST(wagerRequirement AS CHAR) AS required,CAST(wagerProgress AS CHAR) AS progress,role,banned,accountLock,DATE_FORMAT(CURRENT_DATE(),'%Y-%m-%d') AS today FROM users WHERE id=?",[userId]);
  if(!user)throw Object.assign(new Error('UNAUTHORIZED'),{publicError:'UNAUTHORIZED',status:401});
  const [profile,[games],[cashRows],[inventoryRows],[recent],[daily],rewardState,depositBonus,tips]=await Promise.all([
   profiles.get(userId),
   sql.query('SELECT game,CAST(COUNT(*) AS CHAR) AS rounds,CAST(SUM(amount) AS CHAR) AS wagered,CAST(SUM(winnings) AS CHAR) AS returnsAmount,CAST(SUM(CASE WHEN winnings>amount THEN 1 ELSE 0 END) AS CHAR) AS profitableRounds FROM bets WHERE userId=? AND completed=1 AND amount>0 AND game IN (?) GROUP BY game',[userId,[...GAMES]]),
   sql.query("SELECT type,status,CAST(COUNT(*) AS CHAR) AS count,CAST(COALESCE(SUM(amount),0) AS CHAR) AS amount FROM transactions WHERE userId=? AND type IN ('crypto_deposit','crypto_withdraw') GROUP BY type,status",[userId]),
   sql.query("SELECT CAST(COUNT(*) AS CHAR) AS count,CAST(COALESCE(SUM(price),0) AS CHAR) AS value FROM inventory WHERE userId=? AND status='AVAILABLE'",[userId]),
   sql.query('SELECT CAST(id AS CHAR) AS id,game,CAST(amount AS CHAR) AS amount,CAST(winnings AS CHAR) AS returnsAmount,createdAt FROM bets WHERE userId=? AND completed=1 AND amount>0 AND game IN (?) ORDER BY id DESC LIMIT 8',[userId,[...GAMES]]),
   sql.query("SELECT DATE_FORMAT(createdAt,'%Y-%m-%d') AS day,CAST(COALESCE(SUM(amount),0) AS CHAR) AS wagered,CAST(COUNT(*) AS CHAR) AS rounds FROM bets WHERE userId=? AND completed=1 AND amount>0 AND game IN (?) AND createdAt>=CURRENT_DATE()-INTERVAL 6 DAY AND createdAt<CURRENT_DATE()+INTERVAL 1 DAY GROUP BY DATE_FORMAT(createdAt,'%Y-%m-%d') ORDER BY day",[userId,[...GAMES]]),
   rewards.status(userId).catch(e=>{if(e.publicError==='ACCOUNT_RESTRICTED')return null;throw e;}),bonus.progress(sql,userId),tipWagering.progress(sql,userId)
  ]);
  const wagered=games.reduce((n,g)=>n+cents(g.wagered),0n),returned=games.reduce((n,g)=>n+cents(g.returnsAmount),0n),rounds=games.reduce((n,g)=>n+BigInt(g.rounds),0n);
  const totalLeft=remaining(user.required,user.progress),tipLeft=cents(tips.remaining),bonusLeft=depositBonus?cents(depositBonus.remaining):0n;
  const ordinaryRequired=cents(user.required)-cents(tips.required)-(depositBonus?cents(depositBonus.required):0n),ordinaryLeft=totalLeft-tipLeft-bonusLeft;
  const cash=(type,status)=>cashRows.filter(x=>x.type===type&&x.status===status).reduce((sum,r)=>sum+cents(r.amount),0n);
  const days=[];for(let offset=6;offset>=0;offset--){const day=new Date(user.today+'T12:00:00Z');day.setUTCDate(day.getUTCDate()-offset);const key=day.toISOString().slice(0,10),row=daily.find(d=>d.day===key);days.push({day:key,wagered:row?.wagered||zero,rounds:row?.rounds||'0'});}
  return{version:VERSION,fetchedAt:new Date().toISOString(),profile,balance:user.balance,
   stats:{totalWagered:decimal(wagered),totalReturns:decimal(returned),netResult:signed(returned-wagered),completedRounds:rounds.toString(),inventoryCount:String(inventoryRows[0].count),inventoryValue:String(inventoryRows[0].value),deposited:decimal(cash('crypto_deposit','approved')),withdrawn:decimal(cash('crypto_withdraw','approved')),pendingDeposits:decimal(cash('crypto_deposit','pending')),pendingWithdrawals:decimal(cash('crypto_withdraw','pending'))},
   games:games.map(g=>({...g,rounds:String(g.rounds),profitableRounds:String(g.profitableRounds),netResult:signed(cents(g.returnsAmount)-cents(g.wagered))})),recent,daily:days,rewards:rewardState,
   wagering:{overall:progress(user.required,decimal(totalLeft)),ordinary:progress(decimal(ordinaryRequired>0n?ordinaryRequired:0n),decimal(ordinaryLeft>0n?ordinaryLeft:0n)),tips:{...progress(tips.required,tips.remaining),received:tips.received,multiplier:tips.multiplier,qualifyingGames:tips.qualifyingGames},bonus:depositBonus?{...depositBonus,...progress(depositBonus.required,depositBonus.remaining)}:null,minWithdrawal:'15.00',canRequestWithdrawal:totalLeft===0n&&cents(user.balance)>=1500n&&!user.banned&&!user.accountLock&&String(user.role).toUpperCase()!=='BOT'}
  };
 }
 return{get};
}
module.exports={VERSION,progress,createDashboard};
