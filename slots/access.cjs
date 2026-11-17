'use strict';
// Shared policy for authenticated API access and acceptance of NEW bets.
// Win/refund settlement and replay do not use this gate.
const PLAYER_ROLES=Object.freeze(['USER','STREAMER','AFFILIATE_MANAGER','MOD','DEV','ADMIN','OWNER']);
const roles=new Set(PLAYER_ROLES);
const MAX_PLAYER_BET=10000n; // USD 1.0000 in the provider's four-decimal units.
function canPlay(user) {
 return !!user && roles.has(String(user.role).toUpperCase()) &&
  !user.banned && !user.accountLock && !user.sponsorLock;
}
function stakeLimit(value) {
 if(typeof value!=='bigint'||value<=0n)throw new RangeError('INVALID_SLOT_STAKE_LIMIT');
 return value>MAX_PLAYER_BET?MAX_PLAYER_BET:value;
}
module.exports={PLAYER_ROLES,MAX_PLAYER_BET,canPlay,stakeLimit};
