'use strict';
const crypto=require('node:crypto');
const ROLE='AFFILIATE_MANAGER',ADMINS=new Set(['ADMIN','OWNER','DEV']);
function fail(code,status=400){throw Object.assign(new Error(code),{publicError:code,status});}
function id(v){const s=String(v);if(!/^[1-9]\d{0,19}$/.test(s)||BigInt(s)>18446744073709551615n)fail('INVALID_ID');return s;}
function units(v,scale=2){const m=/^(\d+)(?:\.(\d+))?$/.exec(String(v));if(!m||(m[2]||'').length>scale)fail('INVALID_AMOUNT');return BigInt(m[1]+(m[2]||'').padEnd(scale,'0'));}
function decimal(v,scale=2){if(v<0n)throw Error('Negative manager amount');const s=v.toString().padStart(scale+1,'0');return s.slice(0,-scale)+'.'+s.slice(-scale);}
function amount(v){if(typeof v!=='string'||! /^(0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(v))fail('INVALID_AMOUNT');const n=units(v);if(n<=0n||n>100000000n)fail('INVALID_AMOUNT');return decimal(n);}
function text(v){if(typeof v!=='string'||v.trim().length>500)fail('INVALID_NOTE');return v.trim();}
function page(v){const n=v===undefined?1:Number(v);if(!Number.isInteger(n)||n<1||n>100000)fail('INVALID_PAGE');return n;}
async function insertedId(c){const [[row]]=await c.query('SELECT CAST(LAST_INSERT_ID() AS CHAR) AS id');return id(row.id);}
async function account(c,userId,admin=false,lock=false){const [[u]]=await c.query('SELECT CAST(id AS CHAR) AS id,username,role,banned,accountLock,sponsorLock,CAST(balance AS CHAR) AS balance FROM users WHERE id=?'+(lock?' FOR UPDATE':''),[id(userId)]);if(!u||u.banned||u.accountLock||!(admin?ADMINS.has(u.role):u.role===ROLE))fail(admin?'ADMIN_ONLY':'MANAGER_ONLY',403);return u;}
async function wallet(c,managerId){await c.query('INSERT IGNORE INTO affiliateManagerWallets(managerId) VALUES (?)',[id(managerId)]);const [[w]]=await c.query('SELECT CAST(budget AS CHAR) AS budget,CAST(granted AS CHAR) AS granted,CAST(commissionEarned AS CHAR) AS commissionEarned,CAST(commissionClaimed AS CHAR) AS commissionClaimed FROM affiliateManagerWallets WHERE managerId=? FOR UPDATE',[id(managerId)]);return w;}
async function link(c,streamerId){await c.query('INSERT IGNORE INTO affiliateManagerStreamers(streamerId) VALUES (?)',[id(streamerId)]);const [[r]]=await c.query('SELECT CAST(streamerId AS CHAR) AS streamerId,CAST(managerId AS CHAR) AS managerId,CAST(firstBetId AS CHAR) AS firstBetId,assignedAt,notes FROM affiliateManagerStreamers WHERE streamerId=? FOR UPDATE',[id(streamerId)]);return r;}
async function streamer(c,streamerId){const [[s]]=await c.query('SELECT CAST(id AS CHAR) AS id,username,role,banned,accountLock,sponsorLock FROM users WHERE id=? FOR UPDATE',[id(streamerId)]);if(!s||s.role!=='STREAMER'||s.banned||s.accountLock)fail('STREAMER_UNAVAILABLE',403);return s;}
async function accrue(c,{betId,affiliateId,commissionAmount}){
 const streamerId=id(affiliateId),bet=id(betId),base=units(commissionAmount,8);if(base<=0n)return {status:'no_manager_credit'};
 const [[assignment]]=await c.query(`SELECT CAST(s.managerId AS CHAR) AS managerId,CAST(s.firstBetId AS CHAR) AS firstBetId
 FROM affiliateManagerStreamers s JOIN users m ON m.id=s.managerId JOIN users t ON t.id=s.streamerId
 WHERE s.streamerId=? AND m.role='AFFILIATE_MANAGER' AND m.banned=0 AND m.accountLock=0
 AND t.role='STREAMER' AND t.banned=0 AND t.accountLock=0 FOR UPDATE`,[streamerId]);
 if(!assignment||!assignment.firstBetId||BigInt(bet)<BigInt(assignment.firstBetId))return {status:'no_manager_credit'};
 // Affiliate amount has 8 decimals. Multiplication by 15 creates the exact 15% amount at 10 decimals.
 const managerAmount=decimal(base*15n,10),managerId=id(assignment.managerId);
 await wallet(c,managerId);
 const [saved]=await c.query('INSERT IGNORE INTO affiliateManagerCommissions(betId,managerId,streamerId,affiliateAmount,managerAmount) VALUES (?,?,?,?,?)',[bet,managerId,streamerId,commissionAmount,managerAmount]);
 if(saved.affectedRows!==1)return {status:'already_recorded'};
 await c.query('UPDATE affiliateManagerWallets SET commissionEarned=commissionEarned+? WHERE managerId=?',[managerAmount,managerId]);
 return {status:'recorded',managerId,managerAmount};
}
function createService({sql,transaction,tipWagering,notify=async()=>{}}){
 async function mutate(actorId,kind,input,fn,admin=false){
  actorId=id(actorId);const key=input.requestId;if(typeof key!=='string'||! /^[A-Za-z0-9_-]{16,64}$/.test(key))fail('INVALID_REQUEST_ID');
  const hash=crypto.createHash('sha256').update(JSON.stringify({kind,input})).digest('hex');
  const result=await transaction(async(c,commit)=>{
   // Revalidate the role and account restrictions inside the same transaction as each mutation.
   const actor=await account(c,actorId,admin,true);
   await c.query('INSERT INTO affiliateManagerRequests(actorId,requestId,kind,payloadHash) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE requestId=requestId',[actorId,key,kind,hash]);
   const [[request]]=await c.query('SELECT kind,payloadHash,result FROM affiliateManagerRequests WHERE actorId=? AND requestId=? FOR UPDATE',[actorId,key]);
   if(request.kind!==kind||request.payloadHash!==hash)fail('REQUEST_ID_REUSED',409);
   if(request.result){await commit();return {...(typeof request.result==='string'?JSON.parse(request.result):request.result),reused:true};}
   const event=async(managerId,streamerId,eventAmount,note)=>{await c.query('INSERT INTO affiliateManagerEvents(actorId,managerId,streamerId,kind,amount,note,requestId) VALUES (?,?,?,?,?,?,?)',[actorId,id(managerId),streamerId?id(streamerId):null,kind,eventAmount||'0.00',note||'',key]);return insertedId(c);};
   const value=await fn(c,actor,event);
   await c.query('UPDATE affiliateManagerRequests SET result=? WHERE actorId=? AND requestId=?',[JSON.stringify(value),actorId,key]);
   await commit();return value;
  });
  if(result.balanceUserId)try{await notify(result.balanceUserId);}catch(e){console.error('Manager transfer committed; balance refresh pending.');}
  return result;
 }
 async function me(actorId){const u=await account(sql,actorId),[[w]]=await sql.query('SELECT CAST(budget AS CHAR) AS budget,CAST(granted AS CHAR) AS granted,CAST(commissionEarned AS CHAR) AS commissionEarned,CAST(commissionClaimed AS CHAR) AS commissionClaimed FROM affiliateManagerWallets WHERE managerId=?',[u.id]),[[count]]=await sql.query('SELECT COUNT(*) AS total FROM affiliateManagerStreamers WHERE managerId=?',[u.id]);const earned=units(w?.commissionEarned||'0',10),claimed=units(w?.commissionClaimed||'0',10);return {id:u.id,username:u.username,role:ROLE,ratePercent:15,budget:w?.budget||'0.00',granted:w?.granted||'0.00',commissionEarned:decimal(earned,10),commissionClaimed:decimal(claimed,10),claimable:decimal((earned-claimed)/100000000n),streamers:Number(count.total),grantWagering:'4x; completed Packs and Battles only'};}
 async function list(actorId,query={},unassigned=false){await account(sql,actorId);const p=page(query.page),search=text(query.search||'');if(search.length>32)fail('INVALID_SEARCH');const condition=unassigned?"s.managerId IS NULL AND u.banned=0 AND u.accountLock=0":"s.managerId=?";const params=unassigned?[]:[id(actorId)];params.push('%'+search+'%');const where="u.role='STREAMER' AND "+condition+' AND u.username LIKE ?';const [[n]]=await sql.query('SELECT COUNT(*) AS total FROM users u LEFT JOIN affiliateManagerStreamers s ON s.streamerId=u.id WHERE '+where,params);const [rows]=await sql.query(`SELECT CAST(u.id AS CHAR) AS id,u.username,u.affiliateCode AS code,u.banned,u.accountLock,s.notes,s.assignedAt,
 ${unassigned?"NULL AS balance":"CAST(u.balance AS CHAR) AS balance"},
 ${unassigned?"'0'":"(SELECT CAST(COALESCE(SUM(mc.managerAmount),0) AS CHAR) FROM affiliateManagerCommissions mc WHERE mc.managerId=? AND mc.streamerId=u.id)"} AS managerEarned
 FROM users u LEFT JOIN affiliateManagerStreamers s ON s.streamerId=u.id WHERE ${where} ORDER BY u.username,u.id LIMIT 25 OFFSET ?`,[...(unassigned?[]:[id(actorId)]),...params,(p-1)*25]);return {streamers:rows,total:Number(n.total),page:p,limit:25};}
 function claim(actorId,input){const sid=id(input.streamerId),notes=text(input.notes||'');return mutate(actorId,'claim_streamer',input,async(c,actor,event)=>{if(actor.id===sid)fail('CANNOT_CLAIM_SELF');await streamer(c,sid);const assigned=await link(c,sid);if(assigned.managerId)fail('STREAMER_ALREADY_ASSIGNED',409);const [[last]]=await c.query('SELECT CAST(id AS CHAR) AS id FROM bets ORDER BY id DESC LIMIT 1 FOR UPDATE');const first=(BigInt(last?.id||'0')+1n).toString();await c.query('UPDATE affiliateManagerStreamers SET managerId=?,firstBetId=?,assignedAt=CURRENT_TIMESTAMP(3),notes=? WHERE streamerId=?',[actor.id,first,notes,sid]);await event(actor.id,sid,'0.00',notes);return {success:true,streamerId:sid,firstBetId:first};});}
 function manage(actorId,input,release=false,admin=false){const sid=id(input.streamerId),notes=text(input.notes||'');return mutate(actorId,release?'release_streamer':'update_notes',input,async(c,actor,event)=>{const assigned=await link(c,sid);if(!assigned.managerId||(!admin&&assigned.managerId!==actor.id))fail('STREAMER_NOT_ASSIGNED_TO_YOU',403);const managerId=assigned.managerId;await c.query(release?'UPDATE affiliateManagerStreamers SET managerId=NULL,firstBetId=NULL,notes=? WHERE streamerId=?':'UPDATE affiliateManagerStreamers SET notes=? WHERE streamerId=?',[notes,sid]);await event(managerId,sid,'0.00',notes);return {success:true};},admin);}
 function fund(actorId,input){const managerId=id(input.managerId),value=amount(input.amount),reason=text(input.reason||'');if(!reason)fail('REASON_REQUIRED');return mutate(actorId,'allocate_budget',input,async(c,actor,event)=>{await account(c,managerId,false,true);await wallet(c,managerId);await c.query('UPDATE affiliateManagerWallets SET budget=budget+? WHERE managerId=?',[value,managerId]);await event(managerId,null,value,reason);return {success:true,amount:value};},true);}
 function grant(actorId,input){const sid=id(input.streamerId),value=amount(input.amount),reason=text(input.reason||'');if(!reason)fail('REASON_REQUIRED');return mutate(actorId,'grant_streamer',input,async(c,actor,event)=>{const assigned=await link(c,sid);if(assigned.managerId!==actor.id)fail('STREAMER_NOT_ASSIGNED_TO_YOU',403);await streamer(c,sid);const w=await wallet(c,actor.id);if(units(w.budget)<units(value))fail('MANAGER_BUDGET_EXCEEDED');const [debit]=await c.query('UPDATE affiliateManagerWallets SET budget=budget-?,granted=granted+? WHERE managerId=? AND budget>=?',[value,value,actor.id,value]);if(debit.affectedRows!==1)fail('MANAGER_BUDGET_EXCEEDED');
   await c.query('UPDATE users SET balance=balance+? WHERE id=?',[value,sid]);
   await c.query('INSERT INTO tips(fromUserId,toUserId,amount) VALUES (?,?,?)',[actor.id,sid,value]);
   const tipId=await insertedId(c);
   await c.query("INSERT INTO transactions(userId,amount,type,method,methodId,status) VALUES (?,?,'in','tip',?,'approved')",[sid,value,tipId]);
   const transactionId=await insertedId(c);
   const required=await tipWagering.add(c,sid,transactionId,value);
   await event(actor.id,sid,value,reason);return {success:true,amount:value,streamerId:sid,balanceUserId:sid,wageringRequired:required};
  });}
 function claimCommission(actorId,input){return mutate(actorId,'claim_commission',input,async(c,actor,event)=>{const w=await wallet(c,actor.id),cents=(units(w.commissionEarned,10)-units(w.commissionClaimed,10))/100000000n;if(cents<1n)fail('NO_CLAIMABLE_COMMISSION');const value=decimal(cents);await c.query('UPDATE affiliateManagerWallets SET commissionClaimed=commissionClaimed+? WHERE managerId=?',[value,actor.id]);await c.query('UPDATE users SET balance=balance+? WHERE id=?',[value,actor.id]);const eventId=await event(actor.id,null,value,'15% of assigned streamers affiliate commissions');await c.query("INSERT INTO transactions(userId,amount,type,method,methodId,status) VALUES (?,?,'in','manager_commission',?,'approved')",[actor.id,value,eventId]);return {success:true,amount:value,balanceUserId:actor.id};});}
 async function events(actorId,query={},admin=false){await account(sql,actorId,admin);const managerId=admin?id(query.managerId):id(actorId),p=page(query.page);const [rows]=await sql.query('SELECT CAST(id AS CHAR) AS id,CAST(actorId AS CHAR) AS actorId,CAST(streamerId AS CHAR) AS streamerId,kind,CAST(amount AS CHAR) AS amount,note,createdAt FROM affiliateManagerEvents WHERE managerId=? ORDER BY id DESC LIMIT 26 OFFSET ?',[managerId,(p-1)*25]);return {events:rows.slice(0,25),hasMore:rows.length>25,page:p};}
 async function managers(actorId){await account(sql,actorId,true);const [rows]=await sql.query(`SELECT CAST(u.id AS CHAR) AS id,u.username,u.banned,u.accountLock,CAST(COALESCE(w.budget,0) AS CHAR) AS budget,CAST(COALESCE(w.granted,0) AS CHAR) AS granted,CAST(COALESCE(w.commissionEarned,0) AS CHAR) AS commissionEarned,(SELECT COUNT(*) FROM affiliateManagerStreamers s WHERE s.managerId=u.id) AS streamers FROM users u LEFT JOIN affiliateManagerWallets w ON w.managerId=u.id WHERE u.role='AFFILIATE_MANAGER' ORDER BY u.username LIMIT 200`);return {managers:rows};}
 async function ownedStats(actorId,sid,query){await account(sql,actorId);const [[assignment]]=await sql.query('SELECT streamerId FROM affiliateManagerStreamers WHERE streamerId=? AND managerId=?',[id(sid),id(actorId)]);if(!assignment)fail('STREAMER_NOT_ASSIGNED_TO_YOU',403);const stats=require('./streamer-stats');return stats.stats(sql,await stats.loadStreamer(sql,sid),query);}
 return {me,list,claim,manage,fund,grant,claimCommission,events,managers,ownedStats};
}
module.exports={ROLE,ADMINS,fail,id,units,decimal,amount,account,accrue,createService};
