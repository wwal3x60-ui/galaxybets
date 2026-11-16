'use strict';
const VERSION='weighted-wagering-v1';
const HOUSE_GAMES=new Set(['mines','keno','roulette','jackpot','coinflip','crash','blackjack','upgrader','upgrade']);
const PACK_GAMES=new Set(['case','battle']);
function halfCentRate(game){return PACK_GAMES.has(game)?2n:HOUSE_GAMES.has(game)?1n:0n;}
// All inputs are integer cents/half-cents. A carry belongs to one requirement,
// so wagering before a later deposit cannot leak into that later obligation.
function allocate(available,remaining,carry=0n){
 if(available<0n||remaining<0n||(carry!==0n&&carry!==1n))throw Error('Invalid wagering allocation');
 if(remaining===0n)return {credited:0n,consumed:0n,carry:0n};
 const capacity=remaining*2n-carry;
 const consumed=available<capacity?available:capacity;
 const total=consumed+carry;
 return {credited:total/2n,consumed,carry:total%2n};
}
module.exports={VERSION,HOUSE_GAMES,PACK_GAMES,halfCentRate,allocate};
