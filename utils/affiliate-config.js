'use strict';
const configured=process.env.AFFILIATE_FIRST_ELIGIBLE_BET_ID;
if(process.env.NODE_ENV==='production'&&!configured)throw Error('Set AFFILIATE_FIRST_ELIGIBLE_BET_ID to the persisted Aiven rollout boundary before starting production.');
const firstEligibleBetId=String(configured||'2250');
if(!/^[1-9]\d{0,19}$/.test(firstEligibleBetId)||BigInt(firstEligibleBetId)>18446744073709551615n)throw Error('Invalid affiliate activation boundary');
module.exports=Object.freeze({firstEligibleBetId});
