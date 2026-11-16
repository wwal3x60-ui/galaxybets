'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {closeIfExhausted}=require('../utils/exhausted-wagering');
function fixture(change={}){
 const state={user:{id:1,role:'USER',banned:0,accountLock:0,sponsorLock:0,balance:'0.00',required:'100.00',progress:'30.00'},deposit:{id:500,userId:1,type:'crypto_deposit',status:'pending'},tracked:[{transactionId:'7',remaining:'70.00'}],audit:[],carries:[1],...change};
 const queries=[];
 const c={query:async(q,p)=>{
  queries.push(q);
  if(q.startsWith('SELECT value FROM siteFlags'))return [[{value:'ready'}]];
  if(q.startsWith('SELECT id,role,'))return [[state.user]];
  if(q.startsWith('SELECT id,userId,type,status FROM transactions'))return [[state.deposit]];
  if(q.startsWith('SELECT CAST(transactionId'))return [state.tracked];
  if(q.startsWith('SELECT '))return [[q.includes(state.blocker||'NEVER_MATCH')?{id:123}:undefined]];
  if(q.startsWith('INSERT INTO cashierWagerClosures')){state.audit.push({userId:p[0],depositId:p[1],requirement:p[2],waived:p[3],reason:p[4]});return [{affectedRows:1}];}
  if(q.startsWith('UPDATE cashierDepositWagers')){for(const row of state.tracked)row.remaining='0.00';return [{affectedRows:state.tracked.length}];}
  if(q.startsWith('DELETE FROM cashierWagerRemainders')){state.carries=[];return [{affectedRows:1}];}
  if(q.startsWith('UPDATE users SET wagerProgress')){state.user.progress=state.user.required;return [{affectedRows:1}];}
  throw Error('Unexpected fixture query: '+q);
 }};
 return {c,state,queries};
}
for(const [name,fragment,reason] of [['unfinished bet','FROM bets','UNSETTLED_BET'],['active Mines','FROM mines','ACTIVE_MINES'],['active Coinflip','FROM coinflips','ACTIVE_COINFLIP'],['active Battle','FROM battles','ACTIVE_BATTLE'],['valuable inventory','FROM inventory','INVENTORY_REMAINS'],['pending withdrawal','FROM transactions WHERE userId','WITHDRAWAL_PENDING'],['fractional slot balance','FROM gbSlotWalletRemainders','SLOT_FRACTION_REMAINS'],['open slot round','FROM gbSlotRounds','SLOT_ROUND_OPEN']])test('closure is blocked by '+name,async()=>{const {c,state}=fixture({blocker:fragment});const result=await closeIfExhausted(c,1,500);assert.equal(result.waived,'0.00');assert.equal(result.reason,reason);assert.equal(state.audit.length,0);assert.equal(state.user.progress,'30.00');});
test('closure records old amount and no new requirement',async()=>{const {c,state,queries}=fixture();const result=await closeIfExhausted(c,1,500);assert.equal(result.waived,'70.00');assert.deepEqual(state.audit,[{userId:1,depositId:500,requirement:'7',waived:'70.00',reason:'BALANCE_EXHAUSTED'}]);assert.equal(state.user.progress,'100.00');assert.equal(state.tracked[0].remaining,'0.00');assert.equal(state.carries.length,0);assert(!queries.some(q=>q.includes('balance=')||q.includes('bets SET')||q.includes('xp=')));});
test('legacy remainder gets a separate zero-ID audit bucket',async()=>{const {c,state}=fixture({tracked:[{transactionId:'7',remaining:'50.00'}]});await closeIfExhausted(c,1,500);assert.deepEqual(state.audit.map(a=>[a.requirement,a.waived]),[['0','20.00'],['7','50.00']]);});
test('wrong player or non-pending trigger refuses without writes',async()=>{for(const change of [{userId:2},{status:'approved'},{type:'crypto_withdraw'}]){const f=fixture();Object.assign(f.state.deposit,change);await assert.rejects(()=>closeIfExhausted(f.c,1,500));assert.equal(f.state.audit.length,0);}});
test('positive balance and restricted accounts retain old progress',async()=>{for(const change of [{balance:'0.01'},{role:'BOT'},{banned:1},{accountLock:1},{sponsorLock:1}]){const f=fixture();Object.assign(f.state.user,change);assert.equal((await closeIfExhausted(f.c,1,500)).waived,'0.00');assert.equal(f.state.audit.length,0);}});
test('inconsistent or pre-existing new deposit requirement refuses before writes',async()=>{for(const tracked of [[{transactionId:'7',remaining:'80.00'}],[{transactionId:'500',remaining:'70.00'}]]){const f=fixture({tracked});await assert.rejects(()=>closeIfExhausted(f.c,1,500));assert.equal(f.state.audit.length,0);}});
