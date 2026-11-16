'use strict';
const house=new Set(['keno']);
module.exports=function temporaryGamePolicy(req,res,next){
 let pathname;try{pathname=decodeURIComponent(req.path).toLowerCase().replace(/\/+$/,'');}catch{return res.status(400).json({error:'INVALID_PATH'});}
 pathname=pathname.replace(/^\/api(?:\/v1)?(?=\/)/,'');
 if(req.method==='POST'&&/^\/withdrawals\/crypto$/.test(pathname)&&req.body?.amount!=null&&Number(req.body.amount)<15)return res.status(400).json({error:'MIN_WITHDRAWAL_FIFTEEN_DOLLARS'});
 pathname=pathname.replace(/^\/games(?=\/)/,'');
 const parts=pathname.split('/').filter(Boolean),game=parts[0];
 if(!house.has(game)||['GET','HEAD','OPTIONS'].includes(req.method))return next();
 return res.status(503).json({error:'DISABLED',message:'Keno is temporarily unavailable.'});
};
