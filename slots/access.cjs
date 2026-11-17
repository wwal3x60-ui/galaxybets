'use strict';
// Shared policy for authenticated API access and acceptance of NEW bets.
// Win/refund settlement and replay do not use this gate.
const PLAYER_ROLES=Object.freeze(['USER','STREAMER','AFFILIATE_MANAGER','MOD','DEV','ADMIN','OWNER']);
const roles=new Set(PLAYER_ROLES);
function canPlay(user) {
 return !!user && roles.has(String(user.role).toUpperCase()) &&
  !user.banned && !user.accountLock && !user.sponsorLock;
}
function stakeLimit(value) {
 // Null means no custom site ceiling; game/provider limits still apply.
 if(value==null)return null;
 if(typeof value!=='bigint'||value<=0n)throw new RangeError('INVALID_SLOT_STAKE_LIMIT');
 return value;
}
module.exports={PLAYER_ROLES,canPlay,stakeLimit};
