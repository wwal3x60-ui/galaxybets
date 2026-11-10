const {MAX_BET_USD}=require('./bet-limits');
'use strict';const crypto=require('crypto');
const MICRO=1000000,TARGET=.95,MAX=1000,MODES=['easy','medium','hard'];
function choose(n,k){if(k<0||k>n)return 0;let v=1;for(let i=1;i<=k;i++)v=v*(n-k+i)/i;return Math.round(v);}
function probability(n,h){return choose(10,h)*choose(30,n-h)/choose(40,n);}
function makeRow(n,mode){const p=Array.from({length:n+1},(_,h)=>probability(n,h));const w=p.map((_,h)=>mode==='easy'?(h+1)**2:mode==='medium'?(h+.2)**3:Math.max(0,h-Math.floor(n/2))**5);const fixed=n===10?n:-1;const value=scale=>p.reduce((sum,prob,h)=>sum+prob*(h===fixed?MAX:Math.min(MAX,w[h]*scale)),0);let lo=0,hi=1;while(value(hi)<TARGET)hi*=2;for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(value(mid)<TARGET)lo=mid;else hi=mid;}return w.map((weight,h)=>h===fixed?MAX*MICRO:Math.floor(Math.min(MAX,weight*lo)*MICRO));}
const tables=Object.fromEntries(MODES.map(m=>[m,Array.from({length:10},(_,i)=>makeRow(i+1,m))]));
// Screenshot reference: ten selected numbers only. Existing 1–9-pick rows are preserved.
const tenPickRows={easy:[0,0,1.1,1.2,1.3,1.8,3.5,13,50,250,1000],medium:[0,0,0,1.6,2,4,7,26,100,500,1000],hard:[0,0,0,0,3.5,8,13,63,500,800,1000]};
for(const mode of MODES)tables[mode][9]=tenPickRows[mode].map(v=>Math.round(v*MICRO));
const returns=Object.fromEntries(MODES.map(mode=>[mode,tables[mode].map((row,i)=>row.reduce((sum,v,h)=>sum+probability(i+1,h)*v/MICRO,0))]));
function draw(serverSeed,clientSeed,nonce){let counter=0,words=[];function random(max){const limit=0x100000000-(0x100000000%max);while(true){if(!words.length){const h=crypto.createHmac('sha256',serverSeed).update(`${clientSeed}:${nonce}:keno:${counter++}`).digest();for(let i=0;i<32;i+=4)words.push(h.readUInt32BE(i));}const v=words.shift();if(v<limit)return v%max;}}const pool=Array.from({length:40},(_,i)=>i+1);for(let i=0;i<10;i++){const j=i+random(40-i);[pool[i],pool[j]]=[pool[j],pool[i]];}return pool.slice(0,10);}
function result(picks,drawn,mode,amountCents){const hits=picks.filter(n=>drawn.includes(n)).length,micros=tables[mode][picks.length-1][hits];const payoutCents=Number(BigInt(amountCents)*BigInt(micros)/BigInt(MICRO));return {hits,multiplier:micros/MICRO,payoutCents,exactMicroCents:(BigInt(amountCents)*BigInt(micros)).toString()};}
function config(){return {numbers:40,drawCount:10,maxPicks:10,minBet:'0.20',maxBet:MAX_BET_USD.toFixed(2),maxMultiplier:MAX,targetReturn:null,payoutVersion:'screenshot-ten-picks-v2',returns,algorithm:'hmac-sha256-fisher-yates-v1',tables:Object.fromEntries(MODES.map(m=>[m,tables[m].map(row=>row.map(v=>v/MICRO))]))};}
module.exports={choose,probability,tables,draw,result,config,MODES};
