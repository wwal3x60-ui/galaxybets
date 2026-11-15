'use strict';
const router=require('express').Router();
const {sql,doTransaction}=require('../../../database');
const {isAuthed,apiLimiter}=require('../../auth/functions');
const io=require('../../../socketio/server');
const {createService,catalog}=require('../../../utils/wager-rewards');
const rewards=createService({sql,transaction:doTransaction,emitBalance:(id,balance)=>io.to(id).emit('balance','set',Number(balance))});
function error(res,e){if(!e.publicError)console.error('Wager rewards:',e.message);return res.status(e.status||503).json({error:e.publicError||'REWARDS_UNAVAILABLE'});}
// Public configuration only: no account IDs, wagering, balances or receipts.
router.get('/levels',[apiLimiter],(_req,res)=>res.json(catalog()));
router.get('/',[isAuthed,apiLimiter],async(req,res)=>{try{return res.json(await rewards.status(req.userId));}catch(e){return error(res,e);}});
router.post('/:milestone/claim',[isAuthed,apiLimiter],async(req,res)=>{
 try{if(req.body&&Object.keys(req.body).length)return res.status(400).json({error:'INVALID_REQUEST'});return res.json(await rewards.claim(req.userId,req.params.milestone));}catch(e){return error(res,e);}
});
module.exports=router;
