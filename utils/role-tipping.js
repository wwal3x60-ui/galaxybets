'use strict';
const crypto=require('crypto');
const {sql,doTransaction}=require('../database');
const io=require('../socketio/server');
const {getUserLevel}=require('./index');
const {enabledFeatures}=require('../routes/admin/config');
const {units,decimal}=require('./cashier-money');
function fail(code,status=400){throw Object.assign(new Error(code),{publicError:code,status});}
const roleOf=u=>String(u.role).trim().toUpperCase();
const admins=new Set(['ADMIN','OWNER']);
function parseAmount(value){
 if(!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(String(value)))fail('INVALID_AMOUNT');
 const valueCents=units(value);if(valueCents<=0n)fail('MIN_TIP_ONE_CENT');return valueCents;
}
async function tip(userId,input){
 if(!enabledFeatures.tips)fail('TIPPING_DISABLED',403);
 const amountCents=parseAmount(input.amount),amount=decimal(amountCents);
 const name=String(input.username||'').trim(),key=String(input.requestId||'');
 if(!/^[A-Za-z0-9_]{3,32}$/.test(name))fail('INVALID_USERNAME');
 if(!/^[A-Za-z0-9_-]{16,64}$/.test(key))fail('INVALID_REQUEST_ID');
 const hash=crypto.createHash('sha256').update(name.toLowerCase()+':'+amount).digest('hex');
 const result=await doTransaction(async(c,commit)=>{
  await c.query("INSERT INTO communityRequests(userId,requestId,kind,payloadHash) VALUES (?,?,'tip',?) ON DUPLICATE KEY UPDATE requestId=requestId",[userId,key,hash]);
  const [[request]]=await c.query('SELECT kind,payloadHash,result FROM communityRequests WHERE userId=? AND requestId=? FOR UPDATE',[userId,key]);
  if(request.kind!=='tip'||request.payloadHash!==hash)fail('REQUEST_ID_REUSED',409);
  if(request.result){await commit();return typeof request.result==='string'?JSON.parse(request.result):request.result;}
  const [[recipient]]=await c.query('SELECT CAST(id AS CHAR) AS id FROM users WHERE LOWER(username)=LOWER(?)',[name]);
  if(!recipient)fail('USER_NOT_FOUND',404);
  if(String(recipient.id)===String(userId))fail('CANNOT_TIP_SELF');
  const accounts=[];
  for(const id of [String(userId),String(recipient.id)].sort((a,b)=>BigInt(a)<BigInt(b)?-1:1)){
   const [[u]]=await c.query('SELECT * FROM users WHERE id=? FOR UPDATE',[id]);accounts.push(u);
  }
  const from=accounts.find(u=>u&&String(u.id)===String(userId)),to=accounts.find(u=>u&&String(u.id)===String(recipient.id));
  if(!from||!to)fail('USER_NOT_FOUND');
  const role=roleOf(from),isStreamer=role==='STREAMER',isAdmin=admins.has(role),exempt=isStreamer||isAdmin;
  if(role==='BOT'||roleOf(to)==='BOT'||from.banned||to.banned||from.tipBan||from.accountLock||to.accountLock)fail('TIPPING_RESTRICTED',403);
  if(!exempt){
   if(from.sponsorLock)fail('TIPPING_RESTRICTED',403);
   if(amountCents<100n)fail('MIN_TIP_ONE_DOLLAR');
   if(getUserLevel(from.xp)<5)fail('TIP_LEVEL_FIVE_REQUIRED');
   await require('./deposit-bonus').assertTipEligible(c,userId);
   const [[dep]]=await c.query("SELECT COALESCE(SUM(amount),0) AS amount FROM transactions WHERE userId=? AND type IN ('deposit','crypto_deposit') AND status='approved' AND createdAt>=?",[userId,new Date(Date.now()-14*86400000)]);
   if(Number(dep.amount)<1)fail('RECENT_APPROVED_DEPOSIT_REQUIRED');
   if(from.tipAllowance!=null&&units(from.tipAllowance)<amountCents)fail('TIP_ALLOWANCE_EXCEEDED');
   if(from.maxPerTip!=null&&units(from.maxPerTip)<amountCents)fail('TIP_LIMIT_EXCEEDED');
   const [[past]]=await c.query('SELECT COALESCE(SUM(amount),0) AS amount FROM tips WHERE fromUserId=? AND toUserId=?',[userId,to.id]);
   if(from.maxTipPerUser!=null&&units(past.amount)+amountCents>units(from.maxTipPerUser))fail('TIP_RECIPIENT_LIMIT_EXCEEDED');
  }
  if(units(from.balance)<amountCents)fail('INSUFFICIENT_BALANCE');
  // Capture one database UTC time so quota accounting and ledger dates agree across midnight.
  const [[clock]]=await c.query("SELECT DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%d %H:%i:%s') AS tipTime, DATE_FORMAT(UTC_DATE(),'%Y-%m-%d 00:00:00') AS startsAt, DATE_FORMAT(UTC_DATE()+INTERVAL 1 DAY,'%Y-%m-%d 00:00:00') AS endsAt");
  if(isStreamer){
   // A locking CURRENT read is essential: a snapshot taken before the sender lock may be stale.
   const [today]=await c.query(`SELECT CAST(x.amount AS CHAR) AS amount,CAST(t.toUserId AS CHAR) AS toUserId
    FROM transactions x JOIN tips t ON x.methodId=CAST(t.id AS CHAR) AND x.userId=t.fromUserId
    WHERE x.userId=? AND x.type='out' AND x.method='tip' AND x.status='approved'
      AND x.createdAt>=? AND x.createdAt<? FOR UPDATE`,[userId,clock.startsAt,clock.endsAt]);
   const total=today.reduce((sum,row)=>sum+units(row.amount),0n);
   const person=today.filter(row=>String(row.toUserId)===String(to.id)).reduce((sum,row)=>sum+units(row.amount),0n);
   if(total+amountCents>3000n)fail('STREAMER_DAILY_TIP_LIMIT');
   if(person+amountCents>500n)fail('STREAMER_RECIPIENT_DAILY_TIP_LIMIT');
  }
  if(exempt)await c.query('UPDATE users SET balance=balance-? WHERE id=?',[amount,userId]);
  else await c.query('UPDATE users SET balance=balance-?,tipAllowance=IF(tipAllowance IS NULL,NULL,tipAllowance-?) WHERE id=?',[amount,amount,userId]);
  await c.query('UPDATE users SET balance=balance+? WHERE id=?',[amount,to.id]);
  const [row]=await c.query('INSERT INTO tips(fromUserId,toUserId,amount) VALUES (?,?,?)',[userId,to.id,amount]);
  let incomingId;
  for(const [id,type] of [[userId,'out'],[to.id,'in']]){
   const [entry]=await c.query("INSERT INTO transactions(userId,amount,type,method,methodId,status,createdAt) VALUES (?,?,?,'tip',?,'approved',?)",[id,amount,type,String(row.insertId),clock.tipTime]);
   if(type==='in')incomingId=entry.insertId;
  }
  // Recipient wagering, incoming ledger, both balances and idempotency share this commit.
  await require('./tip-wagering').add(c,to.id,incomingId,amount);
  const value={success:true,tipId:String(row.insertId),username:to.username,amount,balance:decimal(units(from.balance)-amountCents),recipientWageringRequired:decimal(amountCents*4n)};
  await c.query('UPDATE communityRequests SET result=? WHERE userId=? AND requestId=?',[JSON.stringify(value),userId,key]);
  await commit();return value;
 });
 try{
  for(const q of [{id:userId},{name:result.username}]){
   const [[u]]=q.id?await sql.query('SELECT id,balance FROM users WHERE id=?',[q.id]):await sql.query('SELECT id,balance FROM users WHERE username=?',[q.name]);
   if(u)io.to(String(u.id)).emit('balance','set',Number(u.balance));
  }
 }catch(e){console.error('Tip committed; balance refresh pending:',e.message);}
 return result;
}
module.exports={tip,parseAmount};
