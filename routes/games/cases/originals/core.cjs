'use strict';
const crypto=require('node:crypto'),rng=require('./rng.cjs');
const GAME='cs2_case',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=(code,status=400)=>{throw Object.assign(Error(code),{status});};
function cents(v){if(!/^\d+(\.\d{1,2})?$/.test(String(v)))fail('INVALID_MONEY');const [a,b='']=String(v).split('.');return BigInt(a)*100n+BigInt(b.padEnd(2,'0'));}
function money(v){const n=BigInt(v);if(n<0n)fail('INVALID_MONEY');const t=n.toString().padStart(3,'0');return t.slice(0,-2)+'.'+t.slice(-2);}
function validate(input){
 if(!input||!uuid.test(input.requestId)||!uuid.test(input.commitId)||typeof input.slug!=='string'||!/^[a-z0-9-]{1,64}$/.test(input.slug)||typeof input.version!=='string'||!/^[a-f0-9]{64}$/.test(input.version)||typeof input.clientSeed!=='string'||!/^[\x21-\x7e]{1,128}$/.test(input.clientSeed)||!Number.isInteger(input.quantity)||input.quantity<1||input.quantity>4)fail('INVALID_REQUEST');
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify([input.slug,input.version,input.quantity,input.commitId,input.clientSeed])).digest('hex');return {...input,fingerprint};
}
const parse=v=>typeof v==='string'?JSON.parse(v):v;
async function lockUser(c,id){const [[u]]=await c.query('SELECT id,username,role,anon,xp,banned,accountLock,CAST(balance AS CHAR) AS balance FROM users WHERE id=? FOR UPDATE',[id]);if(!u)fail('UNKNOWN_USER',404);return u;}
async function settle(c,userId,input,{catalog,skins,releaseHash,maxBetCents,xpMultiplier=0,credit=async()=>[],xpChanged=async()=>{},enabled=true}){
 const b=validate(input),user=await lockUser(c,userId);
 const [[prior]]=await c.query('SELECT fingerprint,receipt FROM cs2CaseRequests WHERE userId=? AND requestId=? FOR UPDATE',[userId,b.requestId]);
 if(prior){if(prior.fingerprint!==b.fingerprint)fail('REQUEST_CONFLICT',409);return {receipt:parse(prior.receipt),replay:true,credits:[]};}
 if(Number(user.banned)||Number(user.accountLock)||user.role==='BOT')fail('ACCOUNT_LOCKED',403);
 if(!enabled)fail('DISABLED');
 const [[release]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_cs2_case_release_v1' LOCK IN SHARE MODE");if(release?.value!==releaseHash)fail('NOT_READY',503);
 const item=catalog.get(b.slug);if(!item||rng.version(item)!==b.version)fail('CATALOG_CHANGED',409);
 const cost=BigInt(item.priceCents)*BigInt(b.quantity);if(cost>maxBetCents)fail('MAX_BET');if(cents(user.balance)<cost)fail('INSUFFICIENT_BALANCE');
 const [[commit]]=await c.query('SELECT * FROM cs2CaseCommitments WHERE id=? AND userId=? FOR UPDATE',[b.commitId,userId]);
 if(!commit||commit.usedRequestId||commit.caseSlug!==b.slug||commit.caseVersion!==b.version||Number(commit.quantity)!==b.quantity||(!Number.isFinite(new Date(commit.expiresAt).getTime())||new Date(commit.expiresAt).getTime()<=Date.now()))fail('INVALID_COMMITMENT',409);
 if(rng.hash(commit.serverSeed)!==commit.serverSeedHash)fail('INVALID_COMMITMENT',503);
 const results=[],gameIds=[];let total=0n;
 for(let index=0;index<b.quantity;index++){
  const context={commitId:b.commitId,slug:b.slug,version:b.version,clientSeed:b.clientSeed,index},proof=rng.ticket(commit.serverSeed,context),reward=rng.select(item,proof.ticket),skin=skins.get(reward.skinId);if(!skin)fail('CATALOG_CHANGED',503);
  const name=skin.name+(skin.phase?' · '+skin.phase:'');
  await c.query('INSERT INTO cs2CaseResults(userId,requestId,itemIndex,caseSlug,skinId,name,img,price) VALUES(?,?,?,?,?,?,?,?)',[userId,b.requestId,index,b.slug,skin.id,name,skin.image,money(reward.valueCents)]);
  const [[saved]]=await c.query('SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id');if(!/^[1-9]\d*$/.test(saved.id))fail('INVALID_RECEIPT',503);
  gameIds.push(saved.id);total+=BigInt(reward.valueCents);
  const edge=money((BigInt(item.priceCents)*10n+50n)/100n);
  await c.query('INSERT INTO bets(userId,amount,winnings,edge,game,gameId,completed) VALUES(?,?,?,?,?,?,1)',[userId,money(item.priceCents),money(reward.valueCents),edge,GAME,saved.id]);
  results.push({id:saved.id,inventoryId:'cs2:'+saved.id,skinId:skin.id,name,image:skin.image,valueCents:reward.valueCents,index,ticket:proof.ticket,retry:proof.retry,offset:proof.offset});
 }
 const xp=Math.max(0,Math.floor(Number(money(cost))*Number(xpMultiplier||0)));if(!Number.isSafeInteger(xp))fail('INVALID_XP',503);
 const [debited]=await c.query('UPDATE users SET balance=balance-?,xp=xp+? WHERE id=? AND balance>=?',[money(cost),xp,userId,money(cost)]);if(debited.affectedRows!==1)fail('INSUFFICIENT_BALANCE');
 if(xp)await xpChanged(userId,user.xp,Number(user.xp)+xp,c);
 const credits=await credit(c,GAME,gameIds);
 const receipt={createdAt:new Date().toISOString(),algorithm:rng.ALGORITHM,requestId:b.requestId,commitId:b.commitId,slug:b.slug,version:b.version,quantity:b.quantity,casePriceCents:item.priceCents,rewards:item.rewards,clientSeed:b.clientSeed,serverSeedHash:commit.serverSeedHash,serverSeed:commit.serverSeed,costCents:Number(cost),totalValueCents:Number(total),balance:money(cents(user.balance)-cost),results};
 const [consumed]=await c.query('UPDATE cs2CaseCommitments SET usedRequestId=? WHERE id=? AND usedRequestId IS NULL',[b.requestId,b.commitId]);if(consumed.affectedRows!==1)fail('INVALID_COMMITMENT',409);
 await c.query('INSERT INTO cs2CaseRequests(userId,requestId,fingerprint,receipt) VALUES(?,?,?,?)',[userId,b.requestId,b.fingerprint,JSON.stringify(receipt)]);
 return {receipt,replay:false,credits};
}
async function recover(c,userId,requestId){if(!uuid.test(requestId))fail('INVALID_REQUEST');await lockUser(c,userId);const [[r]]=await c.query('SELECT receipt FROM cs2CaseRequests WHERE userId=? AND requestId=? FOR UPDATE',[userId,requestId]);return r?parse(r.receipt):null;}
async function sell(c,userId,ids){
 if(!Array.isArray(ids)||ids.length<1||ids.length>100||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^(cs2:)?[1-9]\d{0,19}$/.test(id)))fail('INVALID_IDS');
 const user=await lockUser(c,userId);if(Number(user.banned)||Number(user.accountLock)||user.role==='BOT')fail('ACCOUNT_LOCKED',403);
 let total=0n;for(const kind of ['legacy','cs2']){const wanted=ids.filter(id=>id.startsWith('cs2:')===(kind==='cs2')).map(id=>id.replace(/^cs2:/,''));if(!wanted.length)continue;const table=kind==='cs2'?'cs2CaseResults':'inventory';const [rows]=await c.query(`SELECT CAST(id AS CHAR) AS id,CAST(price AS CHAR) AS price FROM ${table} WHERE userId=? AND status='AVAILABLE' AND id IN (?) ORDER BY id FOR UPDATE`,[userId,wanted]);if(rows.length!==wanted.length)fail('ITEMS_NOT_AVAILABLE',409);for(const r of rows)total+=cents(r.price);const [sold]=await c.query(`UPDATE ${table} SET status='SOLD',soldAt=CURRENT_TIMESTAMP(3) WHERE userId=? AND status='AVAILABLE' AND id IN (?)`,[userId,wanted]);if(sold.affectedRows!==wanted.length)fail('ITEMS_NOT_AVAILABLE',409);}
 await c.query('UPDATE users SET balance=balance+? WHERE id=?',[money(total),userId]);return{success:true,totalPrice:money(total),balance:money(cents(user.balance)+total)};
}
module.exports={GAME,cents,money,validate,settle,recover,sell};
