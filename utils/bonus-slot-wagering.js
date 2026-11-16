'use strict';
const {units,decimal}=require('./cashier-money');
const VERSION='streamer-ftd-v5-400-40x-slots';
const signed=n=>n<0n?'-'+decimal(-n):decimal(n);
// Called after the accepted callback ledger insert, inside the SAME wallet
// transaction and user lock. Replays return before this hook. No wallet, XP,
// game statistics, affiliate commission or historical claim terms are changed.
async function onTransfer(c,body,amount){
 const [[ready]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_bonus_400_schema_v2'");
 if(ready?.value!=='ready')return;
 if(body.Reason==='bet'&&!body.FreeRound){
  const [[requirement]]=await c.query("SELECT w.transactionId FROM cashierDepositWagers w JOIN depositBonusRequests r ON r.transactionId=w.transactionId WHERE w.userId=? AND w.remaining>0 AND r.version=? AND r.status='awarded' ORDER BY w.transactionId LIMIT 1 FOR UPDATE",[body.UserID,VERSION]);
  if(requirement)await c.query('INSERT IGNORE INTO cashierBonusSlotBets(appId,transactionId,userId,requirementTransactionId,roundId,stakeUnits) VALUES (?,?,?,?,?,?)',[body.AppID,body.TransactionID,body.UserID,requirement.transactionId,body.RoundID,(-amount).toString()]);
 }
 if(body.Reason==='refund')await c.query('UPDATE cashierBonusSlotBets SET refunded=1 WHERE appId=? AND transactionId=? AND userId=?',[body.AppID,body.RefTransactionID,body.UserID]);
 if(body.IsEnd)await c.query('UPDATE cashierBonusSlotBets SET settled=1 WHERE appId=? AND roundId=? AND userId=?',[body.AppID,body.RoundID,body.UserID]);
 const [requirements]=await c.query('SELECT DISTINCT requirementTransactionId FROM cashierBonusSlotBets WHERE appId=? AND roundId=? AND userId=?',[body.AppID,body.RoundID,body.UserID]);
 for(const row of requirements){
  const id=row.requirementTransactionId;
  const [[w]]=await c.query('SELECT CAST(remaining AS CHAR) AS remaining FROM cashierDepositWagers WHERE transactionId=? AND userId=? FOR UPDATE',[id,body.UserID]);
  if(!w)throw Error('Slots bonus requirement missing');
  await c.query('INSERT IGNORE INTO cashierBonusSlotCredits(userId,requirementTransactionId,credited) VALUES (?,?,0)',[body.UserID,id]);
  const [[old]]=await c.query('SELECT CAST(credited AS CHAR) AS credited FROM cashierBonusSlotCredits WHERE userId=? AND requirementTransactionId=? FOR UPDATE',[body.UserID,id]);
  const [[stake]]=await c.query('SELECT CAST(COALESCE(SUM(stakeUnits),0) AS CHAR) AS stakeUnits FROM cashierBonusSlotBets WHERE userId=? AND requirementTransactionId=? AND settled=1 AND refunded=0',[body.UserID,id]);
  const earned=BigInt(stake.stakeUnits)/100n,previous=units(old.credited),capacity=previous+units(w.remaining);
  const next=earned<capacity?earned:capacity,delta=next-previous;
  if(delta===0n)continue;
  const [[u]]=await c.query('SELECT CAST(wagerProgress AS CHAR) AS progress FROM users WHERE id=? FOR UPDATE',[body.UserID]);
  if(!u||units(u.progress)+delta<0n)throw Error('Inconsistent slots wagering progress');
  await c.query('UPDATE cashierDepositWagers SET remaining=remaining-? WHERE transactionId=? AND userId=?',[signed(delta),id,body.UserID]);
  await c.query('UPDATE users SET wagerProgress=wagerProgress+? WHERE id=?',[signed(delta),body.UserID]);
  await c.query('UPDATE cashierBonusSlotCredits SET credited=? WHERE userId=? AND requirementTransactionId=?',[decimal(next),body.UserID,id]);
 }
}
module.exports={VERSION,onTransfer};
