'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const bonus=require('../utils/deposit-bonus');
const {progress}=require('../utils/account-dashboard');
for(const [amount,award,total,wager] of [['50','200.00','250.00','10000.00'],['500','2000.00','2500.00','100000.00'],['12500','50000.00','62500.00','2500000.00'],['20000','50000.00','70000.00','2800000.00'],['50.01','200.04','250.05','10002.00']])test('v5 quote '+amount,()=>{const q=bonus.calculate(amount,'QA400');assert.equal(q.rate,400);assert.equal(q.bonus,award);assert.equal(q.creditedTotal,total);assert.equal(q.required,wager);assert.equal(q.version,'streamer-ftd-v5-400-40x-slots');assert.equal(q.multiplier,'40');});
test('below minimum fails with new minimum error',()=>assert.throws(()=>bonus.calculate('49.99'),e=>e.publicError==='BONUS_MIN_DEPOSIT_50'));
for(const version of ['streamer-ftd-v3-5x','streamer-ftd-v2','jammy-ftd-v1'])test('historical '+version,()=>{const q=bonus.calculate('40','JAMMMY',version);assert.equal(q.rate,10);assert.equal(q.bonus,'4.00');assert.equal(q.required,version==='streamer-ftd-v3-5x'?'220.00':'79.20');assert.equal(bonus.calculate('10000','',version).bonus,'500.00');});
test('legacy final requirement rounds up to cents',()=>assert.equal(bonus.calculate('40.01','','streamer-ftd-v2').required,'79.22'));
test('unsupported policy fails closed',()=>assert.throws(()=>bonus.calculate('50','','unknown')));
test('invalid amount is not accepted',()=>assert.throws(()=>bonus.calculate('50.001'),e=>e.publicError==='INVALID_AMOUNT'));
test('v4 needs new readiness flag; v3 only needs original base marker',async()=>{const c={query:async(q,p)=>[[{value:p?'missing':'streamer-ftd-v2'}]]};await assert.rejects(()=>bonus.ensureReady(c),e=>e.publicError==='BONUS_NOT_READY');await bonus.ensureReady(c,'streamer-ftd-v3-5x');});
test('closed progress is never reported as actual wagering',()=>{const p=progress('150.00','50.00','70.00');assert.equal(p.completed,'30.00');assert.equal(p.actualProgress,'30.00');assert.equal(p.waived,'70.00');assert.equal(p.satisfied,'100.00');assert.equal(p.remaining,'50.00');assert.equal(p.percent,66.66);});
test('inconsistent closure report fails closed',()=>assert.throws(()=>progress('100.00','90.00','20.00')));
test('zero obligation reports satisfied without fabricated wagering',()=>{const p=progress('0.00','0.00');assert.equal(p.percent,100);assert.equal(p.completed,'0.00');});

test('accepted v4 stays at 25x and the 400 percent cap',()=>{const q=bonus.calculate('50','QA400','streamer-ftd-v4-400-25x');assert.equal(q.required,'6250.00');assert.equal(q.bonus,'200.00');assert.equal(q.rate,400);});
