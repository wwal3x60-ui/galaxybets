'use strict';
const {units,decimal}=require('./cashier-money');
const {FLAG}=require('./bonus400-schema.cjs');
async function ensureReady(c){
 const [[flag]]=await c.query('SELECT value FROM siteFlags WHERE name=?',[FLAG]);
 if(flag?.value!=='ready')throw Error('Run the bonus400 schema migration before using deposit approval or closure reporting.');
}
async function summary(c,userId){
 await ensureReady(c);
 const [[row]]=await c.query('SELECT CAST(COALESCE(SUM(waivedAmount),0) AS CHAR) AS waived FROM cashierWagerClosures WHERE userId=?',[userId]);
 return row.waived;
}
async function forRequirement(c,userId,transactionId){
 const [[row]]=await c.query('SELECT CAST(COALESCE(SUM(waivedAmount),0) AS CHAR) AS waived FROM cashierWagerClosures WHERE userId=? AND requirementTransactionId=?',[userId,transactionId]);
 return row.waived;
}
// No commit here: the caller locks the user first and commits once after approval.
async function closeIfExhausted(c,userId,approvedDepositId){
 await ensureReady(c);
 const [[user]]=await c.query('SELECT id,role,banned,accountLock,sponsorLock,CAST(balance AS CHAR) AS balance,CAST(wagerRequirement AS CHAR) AS required,CAST(wagerProgress AS CHAR) AS progress FROM users WHERE id=? FOR UPDATE',[userId]);
 const [[deposit]]=await c.query('SELECT id,userId,type,status FROM transactions WHERE id=? FOR UPDATE',[approvedDepositId]);
 if(!user||!deposit||String(deposit.userId)!==String(userId)||deposit.type!=='crypto_deposit'||deposit.status!=='pending')throw Error('Invalid exhaustion closure trigger');
 const none=reason=>({waived:'0.00',reason});
 if(String(user.role).trim().toUpperCase()==='BOT'||user.banned||user.accountLock||user.sponsorLock)return none('ACCOUNT_RESTRICTED');
 if(units(user.balance)!==0n)return none('BALANCE_REMAINS');
 const required=units(user.required),progress=units(user.progress);
 if(progress>required)throw Error('Inconsistent aggregate wagering totals');
 const outstanding=required-progress;
 if(outstanding===0n)return none('NO_OUTSTANDING_REQUIREMENT');
 // Current locking reads protect against stale REPEATABLE READ snapshots. All
 // monetary placement/settlement paths serialize through the same user lock.
 const blockers=[
  ['UNSETTLED_BET','SELECT id FROM bets WHERE userId=? AND completed=0 LIMIT 1 FOR UPDATE',[userId]],
  ['ACTIVE_MINES','SELECT id FROM mines WHERE userId=? AND endedAt IS NULL LIMIT 1 FOR UPDATE',[userId]],
  ['ACTIVE_COINFLIP','SELECT id FROM coinflips WHERE (ownerId=? OR fire=? OR ice=?) AND winnerSide IS NULL LIMIT 1 FOR UPDATE',[userId,userId,userId]],
  ['ACTIVE_BATTLE','SELECT id FROM battles WHERE ownerId=? AND endedAt IS NULL AND cancelledAt IS NULL LIMIT 1 FOR UPDATE',[userId]],
  ['ACTIVE_BATTLE','SELECT b.id FROM battlePlayers p JOIN battles b ON b.id=p.battleId WHERE p.userId=? AND b.endedAt IS NULL AND b.cancelledAt IS NULL LIMIT 1 FOR UPDATE',[userId]],
  ['INVENTORY_REMAINS',"SELECT id FROM inventory WHERE userId=? AND price>0 AND status NOT IN ('SOLD','WITHDRAWN') LIMIT 1 FOR UPDATE",[userId]],
  ['WITHDRAWAL_PENDING',"SELECT id FROM transactions WHERE userId=? AND (type IN ('crypto_withdraw','withdraw','withdrawal') OR method IN ('withdraw','withdrawal')) AND status IN ('pending','processing') LIMIT 1 FOR UPDATE",[userId]],
  ['SLOT_FRACTION_REMAINS','SELECT userId FROM gbSlotWalletRemainders WHERE userId=? AND units<>0 LIMIT 1 FOR UPDATE',[userId]],
  ['SLOT_ROUND_OPEN','SELECT roundId FROM gbSlotRounds WHERE userId=? AND closed=0 LIMIT 1 FOR UPDATE',[userId]],
 ];
 for(const [reason,query,params] of blockers){const [[row]]=await c.query(query,params);if(row)return none(reason);}
 const [tracked]=await c.query('SELECT CAST(transactionId AS CHAR) AS transactionId,CAST(remaining AS CHAR) AS remaining FROM cashierDepositWagers WHERE userId=? AND remaining>0 ORDER BY transactionId FOR UPDATE',[userId]);
 if(tracked.some(row=>String(row.transactionId)===String(approvedDepositId)))throw Error('New deposit already has a wagering requirement');
 const trackedTotal=tracked.reduce((n,row)=>n+units(row.remaining),0n);
 if(trackedTotal>outstanding)throw Error('Tracked requirements exceed aggregate outstanding wagering');
 const legacy=outstanding-trackedTotal;
 const buckets=[...(legacy>0n?[{transactionId:'0',remaining:decimal(legacy)}]:[]),...tracked];
 for(const row of buckets){
  await c.query('INSERT INTO cashierWagerClosures(userId,approvedDepositId,requirementTransactionId,waivedAmount,reason) VALUES (?,?,?,?,?)',[userId,approvedDepositId,row.transactionId,row.remaining,'BALANCE_EXHAUSTED']);
 }
 await c.query('UPDATE cashierDepositWagers SET remaining=0 WHERE userId=? AND remaining>0',[userId]);
 // Discard fractional progress only with the old obligations it belonged to.
 await c.query('DELETE FROM cashierWagerRemainders WHERE userId=?',[userId]);
 await c.query('UPDATE users SET wagerProgress=wagerRequirement WHERE id=?',[userId]);
 return {waived:decimal(outstanding),reason:'BALANCE_EXHAUSTED'};
}
module.exports={ensureReady,summary,forRequirement,closeIfExhausted};
