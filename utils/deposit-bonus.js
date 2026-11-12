'use strict';
const {units,decimal}=require('./cashier-money');
const VERSION='streamer-ftd-v3-5x', PREVIOUS_VERSION='streamer-ftd-v2', LEGACY_VERSION='jammy-ftd-v1';
// Schema is unchanged. The request version records each customer's accepted terms.
const SCHEMA_VERSION=PREVIOUS_VERSION;
function multiplierFor(version){if(version===VERSION)return '5';if(version===PREVIOUS_VERSION||version===LEGACY_VERSION)return '1.8';throw Error('Unsupported stored bonus policy');}
const tiers=[{minimum:'40.00',rate:10},{minimum:'150.00',rate:20},{minimum:'250.00',rate:30},{minimum:'400.00',rate:40},{minimum:'500.00',rate:50}];
function fail(code,status=400){throw Object.assign(new Error(code),{publicError:code,status});}
function normalizeCode(value){if(value==null||value==='')return '';if(typeof value!=='string'||value.length>32)fail('INVALID_BONUS_CODE');const code=value.trim().toUpperCase();if(code&&!/^[A-Z0-9]{2,20}$/.test(code))fail('INVALID_BONUS_CODE');return code;}
function calculate(amount,code='',version=VERSION){
  const multiplier=multiplierFor(version);
  let deposit;try{deposit=units(amount);}catch{fail('INVALID_AMOUNT');}
  if(deposit<4000n)fail('BONUS_MIN_DEPOSIT_40');
  const rate=[...tiers].reverse().find(t=>deposit>=units(t.minimum)).rate;
  const raw=deposit*BigInt(rate)/100n,bonus=raw>50000n?50000n:raw;
  // Round only the final wagering obligation UP to the nearest cent.
  const required=multiplier==='5'?(deposit+bonus)*5n:((deposit+bonus)*18n+9n)/10n;
  return {deposit:decimal(deposit),code,rate,bonus:decimal(bonus),creditedTotal:decimal(deposit+bonus),required:decimal(required),multiplier,version};
}
async function ensureReady(c){
  const [[flag]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_streamer_bonus_version'");
  if(flag?.value!==SCHEMA_VERSION)fail('BONUS_NOT_READY',503);
}
// Resolve on every offer/request; future STREAMER codes need no allow-list update.
async function resolveStreamer(c,userId,code,requireLinked=false){
  const [[owner]]=await c.query('SELECT id,username,role,banned,accountLock FROM users WHERE LOWER(affiliateCode)=LOWER(?) LIMIT 1',[code]);
  if(!owner||String(owner.role).trim().toUpperCase()!=='STREAMER'||owner.banned||owner.accountLock)fail('INVALID_STREAMER_CODE');
  if(String(owner.id)===String(userId))fail('BONUS_OWN_CODE');
  const [links]=await c.query('SELECT affiliateId FROM affiliates WHERE userId=?',[userId]);
  if(links.some(link=>String(link.affiliateId)!==String(owner.id)))fail('BONUS_AFFILIATE_CONFLICT',409);
  const needsAffiliateLink=links.length===0;
  if(requireLinked&&needsAffiliateLink)fail('BONUS_LINK_CODE_FIRST',409);
  return {streamerId:String(owner.id),streamerName:owner.username,needsAffiliateLink};
}
async function readEligibility(c,userId){
  const [[u]]=await c.query('SELECT role,banned,accountLock FROM users WHERE id=?',[userId]);
  if(!u||String(u.role).trim().toUpperCase()==='BOT'||u.banned||u.accountLock)return {eligible:false,reason:'BONUS_ACCOUNT_RESTRICTED'};
  const [[award]]=await c.query('SELECT userId FROM depositBonusAwards WHERE userId=?',[userId]);
  if(award)return {eligible:false,reason:'BONUS_ALREADY_CLAIMED'};
  const [[previous]]=await c.query("SELECT id FROM transactions WHERE userId=? AND type IN ('deposit','crypto_deposit') AND status='approved' AND amount>0 LIMIT 1",[userId]);
  return previous?{eligible:false,reason:'BONUS_FIRST_DEPOSIT_ONLY'}:{eligible:true,reason:null};
}
async function offer(c,userId,amount,rawCode){
  await ensureReady(c);const code=normalizeCode(rawCode),eligibility=await readEligibility(c,userId);
  const streamer=code&&eligibility.eligible?await resolveStreamer(c,userId,code):null;
  return {...eligibility,code,version:VERSION,codeMode:'streamer-affiliate',tiers,maxBonus:'500.00',multiplier:'5',...streamer,quote:code&&amount&&eligibility.eligible?calculate(String(amount),code):null};
}
// Caller holds the depositing user lock. Existing affiliate redemption retains
// its own IP restrictions and commission start boundary; never reassign a referral.
async function saveRequest(c,userId,transactionId,amount,rawCode){
  const code=normalizeCode(rawCode);if(!code)fail('INVALID_STREAMER_CODE');
  const owner=await resolveStreamer(c,userId,code,true),q=calculate(String(amount),code);
  await c.query('INSERT INTO depositBonusRequests(transactionId,userId,code,version,rate,bonusAmount,wagerAmount,status,streamerId) VALUES (?,?,?,?,?,?,?,?,?)',[transactionId,userId,code,VERSION,q.rate,q.bonus,q.required,'pending',owner.streamerId]);
  return q;
}
// Approval holds the user lock, then the deposit lock. Every balance, audit and
// wagering update below shares the cashier's database transaction and commit.
async function approve(c,transaction){
  await ensureReady(c);
  const [[user]]=await c.query('SELECT id,role,banned,accountLock FROM users WHERE id=? FOR UPDATE',[transaction.userId]);
  if(!user)throw Error('Deposit user not found');
  const [[request]]=await c.query('SELECT * FROM depositBonusRequests WHERE transactionId=? FOR UPDATE',[transaction.id]);
  if(!request)return {bonus:'0.00',required:String(transaction.amount),status:'none'};
  if(request.status!=='pending')throw Error('Unexpected bonus request status');
  let reason=null;
  if(String(user.role).trim().toUpperCase()==='BOT'||user.banned||user.accountLock)reason='BONUS_ACCOUNT_RESTRICTED';
  const [[claimed]]=await c.query('SELECT userId FROM depositBonusAwards WHERE userId=? FOR UPDATE',[transaction.userId]);
  if(claimed)reason='BONUS_ALREADY_CLAIMED';
  // Current locking read: do not use a stale REPEATABLE READ snapshot.
  const [[previous]]=await c.query("SELECT id FROM transactions WHERE userId=? AND type IN ('deposit','crypto_deposit') AND status='approved' AND amount>0 AND id<>? LIMIT 1 FOR UPDATE",[transaction.userId,transaction.id]);
  if(previous)reason='BONUS_FIRST_DEPOSIT_ONLY';
  if(reason){await c.query("UPDATE depositBonusRequests SET status='ineligible',reason=? WHERE transactionId=?",[reason,transaction.id]);return {bonus:'0.00',required:String(transaction.amount),status:'ineligible',reason};}
  const legacy=request.version===LEGACY_VERSION&&request.code==='JAMMMY'&&request.streamerId==null;
  if(!legacy&&(![VERSION,PREVIOUS_VERSION].includes(request.version)||!request.streamerId||String(request.streamerId)===String(transaction.userId)))throw Error('Invalid stored streamer bonus identity');
  // Honor the streamer identity accepted with the request even if its code changes later.
  const q=calculate(String(transaction.amount),request.code,request.version);
  if(String(request.userId)!==String(transaction.userId)||normalizeCode(request.code)!==request.code||Number(request.rate)!==q.rate||units(String(request.bonusAmount))!==units(q.bonus)||units(String(request.wagerAmount))!==units(q.required))throw Error('Bonus request does not match reviewed deposit');
  const [ledger]=await c.query("INSERT INTO transactions(userId,amount,type,method,methodId,status) VALUES (?,?,'bonus_credit','deposit_bonus',?,'approved')",[transaction.userId,q.bonus,`${request.code}:${transaction.id}`]);
  await c.query('INSERT INTO depositBonusAwards(userId,transactionId,bonusTransactionId,code,depositAmount,bonusAmount,wagerAmount,streamerId) VALUES (?,?,?,?,?,?,?,?)',[transaction.userId,transaction.id,ledger.insertId,request.code,q.deposit,q.bonus,q.required,request.streamerId??null]);
  await c.query("UPDATE depositBonusRequests SET status='awarded',reason=NULL WHERE transactionId=?",[transaction.id]);
  return {...q,status:'awarded'};
}
async function reject(c,transactionId){await c.query("UPDATE depositBonusRequests SET status='rejected',reason='DEPOSIT_REJECTED' WHERE transactionId=? AND status='pending'",[transactionId]);}
async function progress(c,userId){
  const [[award]]=await c.query(`SELECT a.code,r.version AS bonusVersion,CAST(a.depositAmount AS CHAR) AS deposit,CAST(a.bonusAmount AS CHAR) AS bonus,CAST(a.wagerAmount AS CHAR) AS required,CAST(w.remaining AS CHAR) AS remaining
    FROM depositBonusAwards a JOIN depositBonusRequests r ON r.transactionId=a.transactionId JOIN cashierDepositWagers w ON w.transactionId=a.transactionId WHERE a.userId=?`,[userId]);
  return award?{...award,multiplier:multiplierFor(award.bonusVersion)}:null;
}
async function assertTipEligible(c,userId){const p=await progress(c,userId);if(p&&units(p.remaining)>0n)fail('BONUS_WAGERING_REQUIRED_BEFORE_TIPPING',403);}
module.exports={VERSION,PREVIOUS_VERSION,LEGACY_VERSION,SCHEMA_VERSION,multiplierFor,resolveStreamer,tiers,normalizeCode,calculate,ensureReady,readEligibility,offer,saveRequest,approve,reject,progress,assertTipEligible};
