'use strict';
const router=require('express').Router(),service=require('../../../utils/affiliate-manager-service');
const handle=fn=>async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await fn(req));}catch(e){if(!e.publicError)console.error('Manager admin request failed:',e.code||'INTERNAL_ERROR');res.status(e.status||503).json({error:e.publicError||'MANAGER_UNAVAILABLE'});}};
router.get('/',handle(req=>service.managers(req.userId)));
router.post('/fund',handle(req=>service.fund(req.userId,req.body)));
router.post('/release',handle(req=>service.manage(req.userId,req.body,true,true)));
router.get('/events',handle(req=>service.events(req.userId,req.query,true)));
module.exports=router;
