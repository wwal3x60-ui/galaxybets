const express=require('express');
const router=express.Router();
const {doTransaction}=require('../../../database');
const {isAuthed,apiLimiter}=require('../../auth/functions');
const {roundDecimal,xpChanged}=require('../../../utils');
const io=require('../../../socketio/server');
const {jackpot,broadcastJackpotState}=require('./functions');
const {enabledFeatures,xpMultiplier}=require('../../admin/config');
router.use((req,res,next)=>{if(!enabledFeatures.jackpot)return res.status(400).json({error:'DISABLED'});next();});
function reject(code,status=400){throw Object.assign(new Error(code),{publicError:code,status});}
router.post('/join',isAuthed,apiLimiter,async(req,res)=>{
 const raw=req.body?.amount;
 if(!['number','string'].includes(typeof raw)||!Number.isFinite(Number(raw)))return res.status(400).json({error:'INVALID_AMOUNT'});
 const amount=roundDecimal(Number(raw));const cents=Math.round(amount*100);
 if(!Number.isSafeInteger(cents)||cents<=0)return res.status(400).json({error:'INVALID_AMOUNT'});
 if(amount<jackpot.config.minBet)return res.status(400).json({error:'MIN_BET_JACKPOT'});
 if(amount>jackpot.config.maxBet)return res.status(400).json({error:'MAX_BET_JACKPOT'});
 const roundId=String(jackpot.round.id||'');
 try{
  const result=await doTransaction(async(connection,commit)=>{
   const [[round]]=await connection.query('SELECT CAST(id AS CHAR) AS id,amount,EOSBlock,rolledAt,endedAt,countStartedAt FROM jackpot WHERE id = ? FOR UPDATE',[roundId]);
   if(!round||round.EOSBlock||round.rolledAt||round.endedAt||jackpot.spinning||jackpot.timeLeft<=0||jackpot.round.bettingClosed||String(jackpot.round.id)!==roundId)reject('ALREADY_STARTED');
   if(round.countStartedAt&&Date.now()-new Date(round.countStartedAt).getTime()>=jackpot.config.betTime)reject('ALREADY_STARTED');
   const [[user]]=await connection.query('SELECT id,username,role,sponsorLock,balance,xp,anon FROM users WHERE id = ? FOR UPDATE',[req.userId]);
   if(!user)reject('UNAUTHORIZED',401);if(user.sponsorLock)reject('SPONSOR_LOCK');if(Number(user.balance)<amount)reject('INSUFFICIENT_BALANCE');
   const [[sum]]=await connection.query('SELECT COALESCE(SUM(amount),0) AS amount FROM jackpotBets WHERE jackpotId = ? AND userId = ?',[roundId,user.id]);
   if(Number(sum.amount)+amount>jackpot.config.maxBet)reject('MAX_BET_JACKPOT');
   const totalCents=Math.round(Number(round.amount)*100);if(!Number.isSafeInteger(totalCents)||totalCents<0)throw Error('Invalid jackpot amount');
   const xp=roundDecimal(amount*xpMultiplier);
   await connection.query('UPDATE users SET balance = balance - ?, xp = xp + ? WHERE id = ?',[amount,xp,user.id]);
   const [bet]=await connection.query('INSERT INTO jackpotBets (userId,jackpotId,amount,ticketsFrom,ticketsTo) VALUES (?,?,?,?,?)',[user.id,roundId,amount,totalCents,totalCents+cents-1]);
   await connection.query('INSERT INTO bets (userId,amount,edge,game,gameId,completed) VALUES (?,?,0,?,?,0)',[user.id,amount,'jackpot',bet.insertId]);
   await connection.query('UPDATE jackpot SET amount = ? WHERE id = ?',[(totalCents+cents)/100,roundId]);
   await xpChanged(user.id,user.xp,roundDecimal(user.xp+xp),connection);
   const [[updated]]=await connection.query('SELECT balance FROM users WHERE id = ?',[user.id]);
   await commit();return {userId:user.id,balance:Number(updated.balance)};
  });
  try{
   io.to(String(result.userId)).emit('balance','set',result.balance);
   await broadcastJackpotState(roundId);
  }catch(error){console.error('Jackpot bet committed; live update failed:',error.message);}
  return res.json({success:true});
 }catch(error){if(error.publicError)return res.status(error.status).json({error:error.publicError});console.error('Jackpot bet failed:',error);return res.status(500).json({error:'INTERNAL_ERROR'});}
});
module.exports=router;
