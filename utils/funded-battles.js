'use strict';
const {MAX_BET_USD}=require('./bet-limits');
function fail(code,status=400){throw Object.assign(new Error(code),{publicError:code,status});}
// Old sponsor-only battles retain their original meaning. New funded battles include their creator.
function isPlayerFunded(b){return !b.sponsorOnly&&Number(b.ownerFunding)>0&&Number(b.sponsorPaid)>0;}
function quote(base,players,percentage){
 const cents=Math.round(Number(base)*100);
 if(!Number.isSafeInteger(cents)||cents<1||!Number.isInteger(players)||players<2||players>8||!Number.isInteger(percentage)||percentage<0||percentage>100)fail('INVALID_FUNDING');
 const perSeat=Math.round(cents*percentage/100);
 if(percentage>0&&perSeat<1)fail('FUNDING_TOO_SMALL');
 const sponsoredCents=perSeat*(players-1),costCents=cents+sponsoredCents;
 if(costCents>Math.round(MAX_BET_USD*100)||cents-perSeat>Math.round(MAX_BET_USD*100))fail('MAX_BET_BATTLE');
 return {sponsorOnly:false,entryPrice:(cents-perSeat)/100,cost:costCents/100,sponsorPaid:sponsoredCents/100,creatorStake:cents/100};
}
async function affiliate(c,code,sponsored){const value=String(code||'').trim();if(!value)return null;if(!sponsored)fail('FUNDING_REQUIRED');if(!/^[A-Za-z0-9_-]{1,32}$/.test(value))fail('INVALID_AFFILIATE_CODE');const [[u]]=await c.query('SELECT id,affiliateCode FROM users WHERE LOWER(affiliateCode)=LOWER(?) AND banned=0',[value]);if(!u)fail('INVALID_AFFILIATE_CODE');return {id:u.id,code:u.affiliateCode};}
async function checkJoin(c,b,userId,bot=false){
 if(!b.sponsorOnly&&!isPlayerFunded(b))return;
 if(bot)fail('FUNDED_BATTLE_HUMANS_ONLY');
 if(String(b.ownerId)===String(userId))fail(b.sponsorOnly?'SPONSOR_CANNOT_JOIN':'ALREADY_JOINED');
 if(b.fundingAffiliateId){const [[ref]]=await c.query('SELECT userId FROM affiliates WHERE userId=? AND affiliateId=? FOR UPDATE',[userId,b.fundingAffiliateId]);if(!ref)fail('AFFILIATE_REQUIRED',403);}
}
module.exports={quote,affiliate,checkJoin,fail,isPlayerFunded};
