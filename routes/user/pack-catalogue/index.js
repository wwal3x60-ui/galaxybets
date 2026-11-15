'use strict';
const router=require('express').Router(),rateLimit=require('express-rate-limit'),{sql}=require('../../../database'),{createCatalogue}=require('../../../utils/pack-catalogue');
const catalogue=createCatalogue({sql});
router.get('/',rateLimit({windowMs:60000,max:180,standardHeaders:false,legacyHeaders:false,message:{error:'SLOW_DOWN'}}),async(req,res)=>{try{res.set('Cache-Control','no-store');res.json(await catalogue.list(req.query));}catch(e){const invalid=/^INVALID_/.test(e.message);if(!invalid)console.error('Pack catalogue read failed:',e.code||'UNAVAILABLE');res.status(invalid?400:503).json({error:invalid?e.message:'CATALOGUE_UNAVAILABLE'});}});
module.exports=router;
