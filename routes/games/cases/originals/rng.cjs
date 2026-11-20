'use strict';
const crypto=require('node:crypto');
const ALGORITHM='gb-cs2-hmac-sha256-reject-v1',TOTAL=100000,LIMIT=Math.floor(2**32/TOTAL)*TOTAL;
const hash=seed=>crypto.createHash('sha256').update(Buffer.from(seed,'hex')).digest('hex');
function message({commitId,slug,version,clientSeed,index},retry){return JSON.stringify([ALGORITHM,commitId,slug,version,clientSeed,index,retry]);}
function ticket(serverSeed,context,hmac=(key,msg)=>crypto.createHmac('sha256',Buffer.from(key,'hex')).update(msg).digest()){
 if(!/^[0-9a-f]{64}$/.test(serverSeed)||!Number.isSafeInteger(context.index)||context.index<0)throw Error('INVALID_PROOF');
 for(let retry=0;retry<100;retry++){const digest=hmac(serverSeed,message(context,retry));if(!Buffer.isBuffer(digest)||digest.length!==32)throw Error('INVALID_DIGEST');for(let offset=0;offset<32;offset+=4){const n=digest.readUInt32BE(offset);if(n<LIMIT)return {ticket:n%TOTAL+1,retry,offset};}}
 throw Error('RNG_REJECTION_LIMIT');
}
function validateTable(c){
 if(!c||!Number.isSafeInteger(c.priceCents)||c.priceCents<15||c.priceCents>75000||c.rewards?.length!==20)throw Error('INVALID_CASE');
 let next=1,ev=0;const ids=new Set();for(const r of c.rewards){if(ids.has(r.skinId)||!Number.isSafeInteger(r.valueCents)||r.valueCents<1||!Number.isSafeInteger(r.tickets)||r.tickets<1||r.startTicket!==next||r.endTicket-r.startTicket+1!==r.tickets)throw Error('INVALID_REWARDS');ids.add(r.skinId);next=r.endTicket+1;ev+=r.valueCents*r.tickets;}
 if(next!==100001||!Number.isSafeInteger(ev)||ev>c.priceCents*90000||ev<c.priceCents*89990)throw Error('INVALID_CASE_RTP');
 return c;
}
const version=c=>crypto.createHash('sha256').update(JSON.stringify({slug:c.slug,priceCents:c.priceCents,rewards:c.rewards})).digest('hex');
function select(c,n){if(!Number.isInteger(n)||n<1||n>TOTAL)throw Error('INVALID_TICKET');const r=c.rewards.find(r=>n>=r.startTicket&&n<=r.endTicket);if(!r)throw Error('INCOMPLETE_TABLE');return r;}
module.exports={ALGORITHM,TOTAL,LIMIT,hash,message,ticket,version,validateTable,select};
