'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib/api/house-coinflip.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod={exports:{}},calls=[];let response={};
const client={get:async(url)=>{calls.push(['GET',url]);return {data:response}},post:async(url,body)=>{calls.push(['POST',url,body]);return {data:response}}};
new Function('require','exports','module',compiled)(name=>{assert.equal(name,'./client');return{apiClient:client}},mod.exports,mod);
const {readHouseReceipt,getHouseConfig,playHouseCoinflip,getHouseResult}=mod.exports;
const id='a1111111-1111-4111-8111-111111111111';
const receipt=(extra={})=>({id:'1',requestId:id,side:'fire',winner:'fire',won:true,amount:'1.00',payout:'1.90',multiplier:1.9,createdAt:'2026-11-19T00:00:00Z',...extra});
test('exact-cent wins and valid losses include correct half-cent rounding',()=>{
 for(const [amount,payout] of [['1.00','1.90'],['2.15','4.09'],['0.21','0.40'],['10000.00','19000.00']])assert.equal(readHouseReceipt(receipt({amount,payout})).payout,payout);
 assert.equal(readHouseReceipt(receipt({winner:'ice',won:false,payout:'0.00'})).won,false);
});
test('inconsistent or malformed receipts cannot be displayed as settled wins',()=>{
 for(const extra of [{payout:'1.91'},{won:false},{winner:'heads'},{amount:'1e2'},{amount:'10000.01',payout:'19000.02'},{payout:'-1.00'}])assert.throws(()=>readHouseReceipt(receipt(extra)));
});
test('legacy room backend cannot be treated as an instant house backend',async()=>{
 response={success:true,coinflip:{}};await assert.rejects(getHouseConfig());
 response={success:true,mode:'house',ready:true,enabled:true,minBet:'0.20',maxBet:'10000',multiplier:1.9};assert.equal((await getHouseConfig()).enabled,true);
});
test('receipts match the original stake/side/request; recovery only reads',async()=>{
 response={success:true,result:receipt({side:'ice',winner:'ice'})};await assert.rejects(playHouseCoinflip({requestId:id,side:'fire',amount:'1.00'}));
 calls.length=0;response={success:true,result:receipt()};assert.equal((await getHouseResult(id)).requestId,id);assert.deepEqual(calls,[['GET','/coinflip/instant/result/'+id]]);
});
