'use strict';
const router=require('express').Router();
const {rateLimit}=require('express-rate-limit');
const {sql}=require('../database');
const {createLiveOpenReader}=require('../utils/live-opens');
const read=createLiveOpenReader(sql);
router.use(rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'SLOW_DOWN'}}));
function route(top){return async(req,res)=>{const max=top?10:20;const n=Number(req.query.limit);const limit=Number.isFinite(n)?Math.min(max,Math.max(1,Math.floor(n))):(top?3:16);try{res.set('Cache-Control','no-store');return res.json({success:true,data:await read(limit,top)});}catch(error){console.error('Live opens failed:',error.message);return res.status(500).json({error:'LIVE_OPENS_UNAVAILABLE'});}};}
router.get('/',route(false));router.get('/top',route(true));
module.exports=router;
