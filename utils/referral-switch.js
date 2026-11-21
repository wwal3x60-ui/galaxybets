'use strict';
const VERSION='gb-referral-switch-v1',DAYS=15;
const HISTORY='affiliateReferralHistory';
// Half-open bet intervals keep old/open bets with their original referrer.
const periods=`(SELECT id,userId,affiliateId,createdAt,firstBetId,NULL AS endedAt,NULL AS endBetId FROM affiliates
 UNION ALL SELECT referralId AS id,userId,affiliateId,createdAt,firstBetId,endedAt,endBetId FROM affiliateReferralHistory)`;
const schema=`CREATE TABLE IF NOT EXISTS affiliateReferralHistory (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 referralId BIGINT UNSIGNED NOT NULL,userId BIGINT UNSIGNED NOT NULL,affiliateId BIGINT UNSIGNED NOT NULL,
 createdAt DATETIME NOT NULL,endedAt DATETIME NOT NULL,
 firstBetId BIGINT UNSIGNED NOT NULL,endBetId BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY(id),UNIQUE KEY uq_referral_period(userId,createdAt,endedAt),KEY idx_referral_owner(affiliateId,userId),
 CONSTRAINT chk_referral_period CHECK(endBetId>=firstBetId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`;
function fail(code,status=400,extra={}){throw Object.assign(new Error(code),{publicError:code,status,...extra});}
function id(value){const s=String(value);if(!/^[1-9]\d{0,19}$/.test(s)||BigInt(s)>18446744073709551615n)fail('INVALID_USER');return s;}
function iso(ms){const n=Number(ms);if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid database time');return new Date(n).toISOString();}
async function readLink(c,userId,lock=false){
 const [rows]=await c.query(`SELECT CAST(a.id AS CHAR) AS id,CAST(a.affiliateId AS CHAR) AS affiliateId,
 u.affiliateCode AS code,a.createdAt,CAST(a.firstBetId AS CHAR) AS firstBetId,
 UNIX_TIMESTAMP(DATE_ADD(a.createdAt,INTERVAL 15 DAY))*1000 AS availableMs,
 UNIX_TIMESTAMP(CURRENT_TIMESTAMP())*1000 AS nowMs,
 a.createdAt<=DATE_SUB(CURRENT_TIMESTAMP(),INTERVAL 15 DAY) AS canChange
 FROM affiliates a LEFT JOIN users u ON u.id=a.affiliateId WHERE a.userId=?${lock?' FOR UPDATE':''}`,[id(userId)]);
 if(rows.length>1)fail('AFFILIATE_LINK_CONFLICT',409);
 return rows[0]||null;
}
function publicLink(link){return {code:link?.code||null,affiliateId:link?.affiliateId||null,
 canChange:!link||Boolean(Number(link.canChange)),cooldownDays:DAYS,
 changeAvailableAt:link?iso(link.availableMs):null,serverNow:link?iso(link.nowMs):null,version:VERSION};}
// Caller owns the transaction and commits once. No balance, bonus or ledger writes.
async function applyCode(c,userId,rawCode,ip=''){
 const userKey=id(userId),code=typeof rawCode==='string'?rawCode.trim().toLowerCase():'';
 if(!/^[a-z0-9]{2,20}$/.test(code))fail('INVALID_CODE');
 const [[user]]=await c.query('SELECT CAST(id AS CHAR) AS id,username,role,banned,accountLock,sponsorLock FROM users WHERE id=? FOR UPDATE',[userKey]);
 if(!user||Number(user.banned)||Number(user.accountLock)||Number(user.sponsorLock)||String(user.role).toUpperCase()==='BOT')fail('ACCOUNT_LOCKED');
 const link=await readLink(c,userKey,true);
 const [[owner]]=await c.query('SELECT CAST(id AS CHAR) AS id,username,role,banned,accountLock FROM users WHERE LOWER(affiliateCode)=LOWER(?) FOR UPDATE',[code]);
 if(!owner||Number(owner.banned)||Number(owner.accountLock)||String(owner.role).toUpperCase()==='BOT')fail('CODE_NOT_FOUND',404);
 if(String(owner.id)===userKey)fail('CANT_REDEEM_OWN_CODE');
 // A repeated request for the same owner is a no-op, including renamed codes.
 if(link&&String(link.affiliateId)===String(owner.id))return {success:true,reward:0,reused:true,code,previousAffiliateId:link.affiliateId,affiliateId:String(owner.id),userName:user.username,ownerName:owner.username};
 if(link&&!Number(link.canChange))fail('REFERRAL_CODE_COOLDOWN',409,{changeAvailableAt:iso(link.availableMs)});
 // The user lock serializes wallet actions. This non-locking boundary read avoids
 // waiting on a bet row locked by settlement, which itself may need the user lock.
 const [[last]]=await c.query('SELECT CAST(COALESCE(MAX(id),0) AS CHAR) AS id FROM bets WHERE userId=?',[userKey]);
 const latest=BigInt(last.id)+1n,oldStart=BigInt(link?.firstBetId||'0');
 const firstBetId=(latest>oldStart?latest:oldStart).toString();
 if(BigInt(firstBetId)>18446744073709551615n)throw Error('Bet ID exhausted');
 if(link){
  const [saved]=await c.query(`INSERT INTO affiliateReferralHistory(referralId,userId,affiliateId,createdAt,endedAt,firstBetId,endBetId)
   SELECT id,userId,affiliateId,createdAt,CURRENT_TIMESTAMP(),firstBetId,? FROM affiliates WHERE id=? AND userId=?`,[firstBetId,link.id,userKey]);
  if(saved.affectedRows!==1)throw Error('Referral history not saved');
  const [updated]=await c.query('UPDATE affiliates SET affiliateId=?,createdAt=CURRENT_TIMESTAMP(),firstBetId=?,ip=? WHERE id=? AND userId=?',[owner.id,firstBetId,String(ip).slice(0,45),link.id,userKey]);
  if(updated.affectedRows!==1)throw Error('Referral link not updated');
 }else{
  await c.query('INSERT INTO affiliates(userId,affiliateId,affiliateReward,ip,firstBetId) VALUES (?,?,0,?,?)',[userKey,owner.id,String(ip).slice(0,45),firstBetId]);
 }
 return {success:true,reward:0,reused:false,code,previousAffiliateId:link?.affiliateId||null,affiliateId:String(owner.id),userName:user.username,ownerName:owner.username};
}
module.exports={VERSION,DAYS,HISTORY,periods,schema,readLink,publicLink,applyCode};
