'use strict';
const crypto=require('crypto');
function error(code,status=400){throw Object.assign(new Error(code),{publicError:code,status});}
function dates(query,now=Date.now()){
  if(query.allTime==='1'||query.allTime===true)return {from:new Date(0),to:new Date(now),allTime:true};
  const to=query.to?Date.parse(String(query.to)):now,from=query.from?Date.parse(String(query.from)):to-7*86400000;
  if(!Number.isFinite(from)||!Number.isFinite(to)||from>=to||to-from>366*86400000||to>now+86400000)error('INVALID_DATE_RANGE');
  return {from:new Date(from),to:new Date(to),allTime:false};
}
async function loadStreamer(c,id){const [[u]]=await c.query('SELECT id,username,role,banned,accountLock,affiliateCode FROM users WHERE id=?',[id]);if(!u||u.banned||u.accountLock||String(u.role).toUpperCase()!=='STREAMER')error('STREAMER_ONLY',403);return u;}
async function stats(c,owner,query){
 const window=dates(query),limit=Math.min(100,Math.max(1,Math.floor(Number(query.limit)||50))),page=Math.min(10000,Math.max(1,Math.floor(Number(query.page)||1)));
 // Historical reporting uses the referral link date. Commission eligibility remains
 // independently controlled by firstBetId and AFFILIATE_FIRST_ELIGIBLE_BET_ID.
 const dataset=`WITH refs AS (
   SELECT u.id,u.username,u.anon,MIN(a.createdAt) AS linkedAt FROM affiliates a JOIN users u ON u.id=a.userId
   WHERE a.affiliateId=? AND u.role<>'BOT' GROUP BY u.id,u.username,u.anon
 ), wagers AS (
   SELECT b.userId,SUM(b.amount) AS wagered,SUM(b.winnings) AS payouts,COUNT(*) AS games
   FROM bets b JOIN refs r ON r.id=b.userId WHERE b.completed=1 AND b.createdAt>=r.linkedAt AND b.createdAt>=? AND b.createdAt<? GROUP BY b.userId
 ), transfers AS (
   SELECT t.userId,
   SUM(CASE WHEN t.type IN ('deposit','crypto_deposit') THEN t.amount ELSE 0 END) AS deposited,
   SUM(CASE WHEN t.type IN ('withdraw','crypto_withdraw') THEN t.amount ELSE 0 END) AS withdrawn,
   SUM(CASE WHEN t.type IN ('deposit','crypto_deposit') THEN 1 ELSE 0 END) AS depositCount
   FROM transactions t JOIN refs r ON r.id=t.userId WHERE t.status='approved' AND t.createdAt>=r.linkedAt AND t.createdAt>=? AND t.createdAt<? GROUP BY t.userId
 ), data AS (
   SELECT r.*,COALESCE(w.wagered,0) AS wagered,COALESCE(w.payouts,0) AS payouts,COALESCE(w.games,0) AS games,
   COALESCE(t.deposited,0) AS deposited,COALESCE(t.withdrawn,0) AS withdrawn,COALESCE(t.depositCount,0) AS depositCount
   FROM refs r LEFT JOIN wagers w ON w.userId=r.id LEFT JOIN transfers t ON t.userId=r.id
 ) `;
 const args=[owner.id,window.from,window.to,window.from,window.to];
 const [[summary]]=await c.query(dataset+`SELECT COUNT(*) AS referrals,COALESCE(SUM(wagered),0) AS wagered,COALESCE(SUM(payouts),0) AS payouts,COALESCE(SUM(games),0) AS games,COALESCE(SUM(deposited),0) AS deposited,COALESCE(SUM(withdrawn),0) AS withdrawn,COALESCE(SUM(depositCount),0) AS depositCount FROM data`,args);
 const [rows]=await c.query(dataset+'SELECT * FROM data ORDER BY wagered DESC,id ASC LIMIT ? OFFSET ?',[...args,limit,(page-1)*limit]);
 return {code:owner.affiliateCode,from:window.from.toISOString(),to:window.to.toISOString(),allTime:window.allTime,summary:{referrals:Number(summary.referrals),wagered:String(summary.wagered),payouts:String(summary.payouts),games:Number(summary.games),deposited:String(summary.deposited),withdrawn:String(summary.withdrawn),depositCount:Number(summary.depositCount)},page,limit,total:Number(summary.referrals),players:rows.map(u=>{const id=crypto.createHmac('sha256',String(process.env.JWT_SECRET)).update(String(owner.id)+':'+u.id).digest('hex').slice(0,16);return {id,username:u.anon?'Anonymous '+id.slice(0,6):u.username,anonymous:!!u.anon,wagered:String(u.wagered),payouts:String(u.payouts),net:(Number(u.payouts)-Number(u.wagered)).toFixed(2),games:Number(u.games),deposited:String(u.deposited),withdrawn:String(u.withdrawn),depositCount:Number(u.depositCount)};})};
}
module.exports={error,dates,loadStreamer,stats};
