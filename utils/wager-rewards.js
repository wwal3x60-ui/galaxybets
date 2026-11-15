'use strict';
const MILESTONES=Object.freeze(require('./wager-rewards-levels.json').map(m=>Object.freeze({...m})));
const VERSION='galaxy-passport-v1';
const GAMES=Object.freeze(['case','battle','mines','keno','roulette','coinflip','jackpot']);
function cents(value){const m=/^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));if(!m)throw Error('Invalid database money value');return BigInt(m[1])*100n+BigInt((m[2]||'').padEnd(2,'0'));}
function decimal(n){const text=n.toString().padStart(3,'0');return text.slice(0,-2)+'.'+text.slice(-2);}
if(MILESTONES.length!==20||new Set(MILESTONES.map(m=>m.id)).size!==20||MILESTONES.some((m,i)=>m.level!==i+1||!/^wager-\d+-v1$/.test(m.id)||cents(m.threshold)<=0n||cents(m.reward)*100n!==cents(m.threshold)*2n||(i>0&&cents(m.threshold)<=cents(MILESTONES[i-1].threshold))))throw Error('Invalid 20-level wagering rewards configuration.');
function fail(code,status=400){throw Object.assign(new Error(code),{publicError:code,status});}
function catalog(){return{version:VERSION,levelCount:MILESTONES.length,rewardRatePercent:2,stacking:true,levels:MILESTONES.map(m=>({...m}))};}
function account(user){if(!user||user.banned||user.accountLock||user.sponsorLock||String(user.role).trim().toUpperCase()==='BOT')fail('ACCOUNT_RESTRICTED',403);}
async function wagered(c,userId){const [[row]]=await c.query('SELECT CAST(COALESCE(SUM(amount),0) AS CHAR) AS total FROM bets WHERE userId=? AND completed=1 AND amount>0 AND game IN (?)',[userId,[...GAMES]]);return cents(row.total);}
function createService({sql,transaction,emitBalance=()=>{}}){
 async function status(userId){
  const [[user]]=await sql.query('SELECT id,role,banned,accountLock,sponsorLock,CAST(balance AS CHAR) AS balance FROM users WHERE id=?',[userId]);account(user);
  const total=await wagered(sql,userId),[claimed]=await sql.query('SELECT milestoneCode,rewardAmount,createdAt FROM wagerMilestoneClaims WHERE userId=?',[userId]);const map=new Map(claimed.map(row=>[row.milestoneCode,row]));
  const reached=MILESTONES.filter(m=>total>=cents(m.threshold)),current=reached.at(-1),next=MILESTONES[reached.length],floor=current?cents(current.threshold):0n;
  const milestones=MILESTONES.map(m=>{const target=cents(m.threshold),progress=total<target?total:target,receipt=map.get(m.id);return{...m,claimed:!!receipt,claimedAt:receipt?.createdAt||null,claimedReward:receipt?String(receipt.rewardAmount):null,claimable:!receipt&&total>=target,progress:Number(progress*10000n/target)/100,remaining:decimal(total>=target?0n:target-total)};});
  const available=milestones.filter(m=>m.claimable).reduce((sum,m)=>sum+cents(m.reward),0n),paid=claimed.reduce((sum,row)=>sum+cents(row.rewardAmount),0n);
  return{version:VERSION,levelCount:MILESTONES.length,balance:user.balance,totalWagered:decimal(total),currentLevel:current?.level||0,nextLevel:next?{level:next.level,threshold:next.threshold,remaining:decimal(cents(next.threshold)-total),wageredInLevel:decimal(total-floor),requiredInLevel:decimal(cents(next.threshold)-floor),progress:Number((total-floor)*10000n/(cents(next.threshold)-floor))/100}:null,availableReward:decimal(available),totalClaimed:decimal(paid),claimedCount:claimed.length,milestones};
 }
 async function claim(userId,milestoneCode){
  const milestone=MILESTONES.find(m=>m.id===milestoneCode);if(!milestone)fail('INVALID_MILESTONE');
  const result=await transaction(async(c,commit)=>{
   const [[user]]=await c.query('SELECT id,role,banned,accountLock,sponsorLock,CAST(balance AS CHAR) AS balance FROM users WHERE id=? FOR UPDATE',[userId]);account(user);
   // The user row serializes claims. A plain receipt read avoids cross-user gap-lock deadlocks.
   const [[existing]]=await c.query('SELECT transactionId FROM wagerMilestoneClaims WHERE userId=? AND milestoneCode=?',[userId,milestone.id]);
   if(existing){await commit();return{claimed:true,alreadyClaimed:true,milestone:milestone.id,reward:milestone.reward,balance:user.balance};}
   const total=await wagered(c,userId);if(total<cents(milestone.threshold))fail('WAGER_TARGET_NOT_REACHED',409);
   const [receipt]=await c.query('INSERT INTO wagerMilestoneClaims(userId,milestoneCode,thresholdAmount,rewardAmount,wageredAtClaim) VALUES (?,?,?,?,?)',[userId,milestone.id,milestone.threshold,milestone.reward,decimal(total)]);
   await c.query('UPDATE users SET balance=balance+? WHERE id=?',[milestone.reward,userId]);
   const [tx]=await c.query('INSERT INTO transactions(userId,amount,type,method,methodId) VALUES (?,?,?,?,?)',[userId,milestone.reward,'in','promo',receipt.insertId]);
   await c.query('UPDATE wagerMilestoneClaims SET transactionId=? WHERE id=?',[tx.insertId,receipt.insertId]);
   const [[balance]]=await c.query('SELECT CAST(balance AS CHAR) AS balance FROM users WHERE id=?',[userId]);
   await commit();return{claimed:true,alreadyClaimed:false,milestone:milestone.id,reward:milestone.reward,balance:balance.balance};
  });
  // A committed credit remains successful if its optional socket refresh fails.
  try{const [[fresh]]=await sql.query('SELECT CAST(balance AS CHAR) AS balance FROM users WHERE id=?',[userId]);if(fresh){result.balance=fresh.balance;emitBalance(String(userId),fresh.balance);}}catch(e){console.error('Wager reward committed; live balance refresh pending:',e.message);}
  return result;
 }
 return{status,claim};
}
module.exports={MILESTONES,GAMES,VERSION,catalog,cents,decimal,createService};
