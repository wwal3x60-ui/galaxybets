'use strict';
const router = require('express').Router();
const { sql,doTransaction } = require('../../../database');
const { isAuthed,apiLimiter } = require('../../auth/functions');
const { enabledFeatures,xpMultiplier } = require('../../admin/config');
const { MAX_BET_USD } = require('../../../utils/bet-limits');
const { xpChanged } = require('../../../utils');
const { creditAffiliateGameBets,emitAffiliateCredits,withAffiliateSettlement } = require('../../../utils/affiliate-commission');
const {newBets}=require('../../../socketio/bets');
const io=require('../../../socketio/server');
const core=require('./house-core');
const requestPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
router.get('/',async(req,res)=>{
    try { await sql.query('SELECT id FROM coinflipHouse LIMIT 0');res.json({success:true,mode:'house',ready:true,enabled:Boolean(enabledFeatures.coinflip),minBet:'0.20',maxBet:String(Math.min(10000,MAX_BET_USD)),multiplier:core.MULTIPLIER}); }
    catch(e){res.status(503).json({error:e.code==='ER_NO_SUCH_TABLE'?'MIGRATION_REQUIRED':'UNAVAILABLE'});}
});
// A locking read waits for an in-flight transaction before reporting a missing request.
router.get('/result/:requestId',isAuthed,async(req,res)=>{
    if(!requestPattern.test(req.params.requestId))return res.status(400).json({error:'INVALID_REQUEST_ID'});
    try {let row;await doTransaction(async(c,commit)=>{
        await c.query('SELECT id FROM users WHERE id = ? FOR UPDATE',[req.userId]);
        [[row]]=await c.query('SELECT * FROM coinflipHouse WHERE userId = ? AND requestId = ? FOR UPDATE',[req.userId,req.params.requestId.toLowerCase()]);await commit();
    });return row?res.json({success:true,result:core.publicResult(row)}):res.status(404).json({error:'NOT_FOUND'});}
    catch(e){if(!res.headersSent)res.status(503).json({error:'UNAVAILABLE'});}
});
router.post('/bet',isAuthed,apiLimiter,async(req,res)=>{
    if(!enabledFeatures.coinflip)return res.status(400).json({error:'DISABLED'});
    let settled;
    try {
        await withAffiliateSettlement(async(c,commit)=>{
            settled=await core.settle(c,req.userId,req.body,{maxBet:Math.min(10000,MAX_BET_USD),xpMultiplier,credit:creditAffiliateGameBets,xpChanged});await commit();
        });
    }catch(e){if(!res.headersSent)res.status(e.status||503).json({error:e.status?e.message:e.code==='ER_NO_SUCH_TABLE'?'MIGRATION_REQUIRED':'UNAVAILABLE'});return;}
    // The transaction is committed. Notification failures must never retry or hide its receipt.
    res.json({success:true,result:settled.result,replay:settled.replay});
    if(!settled.replay){
        try{emitAffiliateCredits(settled.credits||[]);void Promise.resolve(newBets([{user:settled.user,amount:settled.amount,edge:settled.edge,payout:settled.payout,game:core.GAME}])).catch(()=>{});io.to(String(req.userId)).emit('coinflip:house:settled',settled.result);}catch(e){console.error('House coinflip notification failed');}
    }
});
module.exports=router;
