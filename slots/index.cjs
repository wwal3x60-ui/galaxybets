'use strict';
const express=require('express');
const {sql}=require('../database');
const {isAuthed}=require('../routes/auth/functions');
const getConfig=require('./config.cjs');
const {authenticate,error,text}=require('./protocol.cjs');
const {Provider}=require('./provider.cjs');
const {Wallet,refusal}=require('./wallet.cjs');
let client;
function context(){const config=getConfig();if(!client||client.config.secret!==config.secret)client=new Provider(config);return {config,provider:client,wallet:new Wallet(sql,config)};}
const router=express.Router();
const parseSlotsJson=express.json({limit:'32kb',strict:true});
router.use((req,res,next)=>req.body!==undefined?next():parseSlotsJson(req,res,next));
async function admin(req,res,next){try{const [[u]]=await sql.query('SELECT role,banned,accountLock,sponsorLock FROM users WHERE id=?',[req.userId]);if(!u||String(u.role).toUpperCase()!=='ADMIN'||u.banned||u.accountLock||u.sponsorLock)return res.status(403).json({error:'ADMIN_TEST_ACCESS_ONLY'});next();}catch{res.status(503).json({error:'DATABASE_UNAVAILABLE'});}}
const handle=fn=>async(req,res)=>{try{await fn(req,res);}catch(e){console.error('Slots request failed:',e.publicError||e.code||'INTERNAL_ERROR');res.status(e.status||503).json({error:e.publicError||'SLOTS_TEMPORARILY_UNAVAILABLE'});}};
for(const [path,kind] of [['/wallet/Cash/Get','get'],['/wallet/Cash/TransferInOut','transfer']]) {
 router.post(path,async(req,res)=>{
  try{const {config,wallet}=context();const {amount}=authenticate(req.body,kind,config);const result=kind==='get'?await wallet.get(req.body.UserID):await wallet.transfer(req.body,amount);res.json(result);
   if(kind==='transfer'&&result.code===0)try{const [[u]]=await sql.query('SELECT balance FROM users WHERE id=?',[req.body.UserID]);require('../socketio/server').to(String(req.body.UserID)).emit('balance','set',Number(u.balance));}catch{console.error('Slots committed; balance refresh pending');}
  }catch(e){console.error('Slots callback refused:',e.publicError||e.code||'TEMPORARY_ERROR');res.status(e.publicError?e.status||400:503).json(refusal(e.publicError||'TEMPORARY_ERROR_RETRY_SAME_TRANSACTION'));}
 });
}
router.use(isAuthed,admin);
router.get('/status',handle(async(req,res)=>{let c;try{c=getConfig();}catch{}const [[schema]]=await sql.query("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('gbSlotTransactions','gbSlotRounds','gbSlotWalletRemainders','gbSlotSessions')");res.json({configured:!!c,enabled:c?.enabled||false,schemaReady:Number(schema.count)===4,currency:'USD',adminOnly:true,maxTestBet:process.env.CODEJACKPOT_MAX_TEST_BET||'1.00',contributions:'Slots do not currently advance wagering, levels, rewards or affiliate commission.'});}));
router.get('/games',handle(async(req,res)=>{const {config,provider}=context();if(!config.enabled)throw error('SLOTS_DISABLED',503);res.json({games:await provider.games()});}));
router.get('/balance',handle(async(req,res)=>res.json(await context().wallet.get(String(req.userId)))));
router.get('/history',handle(async(req,res)=>{const [rounds]=await sql.query('SELECT roundId,gameId,currency,CAST(betTotal AS CHAR) AS betTotal,CAST(winTotal AS CHAR) AS winTotal,CAST(refundTotal AS CHAR) AS refundTotal,closed,createdAt FROM gbSlotRounds WHERE userId=? ORDER BY createdAt DESC LIMIT 50',[req.userId]);res.json({rounds});}));
// One pending launch per player in this process. No automatic retry of a real-money launch.
const launching=new Set();
router.post('/launch',handle(async(req,res)=>{
 const uid=String(req.userId),{config,provider}=context();
 if(!config.enabled)throw error('SLOTS_DISABLED',503);
 if(launching.has(uid))throw error('LAUNCH_IN_PROGRESS',429);
 const gameId=text(req.body?.gameId,'GameID'),platform=req.body?.platform;
 if(!['desktop','mobile'].includes(platform))throw error('INVALID_PLATFORM');
 launching.add(uid);
 try{
  const games=await provider.games();if(!games.some(g=>g.id===gameId))throw error('GAME_UNAVAILABLE',404);
  const [row]=await sql.query('INSERT INTO gbSlotSessions(userId,gameId,currency) VALUES (?,?,?)',[uid,gameId,config.currency]);
  let url;
  try{url=await provider.launch(uid,gameId,platform);}catch(e){await sql.query("UPDATE gbSlotSessions SET state='failed' WHERE id=?",[row.insertId]);throw e;}
  await sql.query("UPDATE gbSlotSessions SET state='launched' WHERE id=?",[row.insertId]);
  res.set('Cache-Control','no-store').json({url});
 }finally{launching.delete(uid);}
}));
module.exports=router;
