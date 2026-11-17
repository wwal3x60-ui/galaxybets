'use strict';
const {money,error}=require('./protocol.cjs');
const {stakeLimit}=require('./access.cjs');
module.exports=function config() {
 const appId=process.env.CODEJACKPOT_APP_ID || 'galaxybetse974';
 const secret=process.env.CODEJACKPOT_SECRET;
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(appId) || !secret || secret.length<16) throw error('SLOTS_NOT_CONFIGURED',503);
 if((process.env.CODEJACKPOT_CURRENCY||'USD')!=='USD') throw error('USD_CONFIGURATION_REQUIRED',503);
 // The retired CODEJACKPOT_MAX_TEST_BET variable is intentionally ignored.
 const rawLimit=process.env.CODEJACKPOT_MAX_BET?.trim();
 const maxBet=rawLimit?stakeLimit(money(rawLimit)):null;
 return {appId,secret,currency:'USD',enabled:process.env.CODEJACKPOT_ENABLED==='1',maxBet};
};
