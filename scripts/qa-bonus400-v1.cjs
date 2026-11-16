'use strict';
// Never reads .env. Only loopback MySQL is allowed. All writes are confined to
// one newly created gb_bonus400_qa_* database, which is removed in finally.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const mysql=require('mysql2/promise');
const bonus=require('../utils/deposit-bonus');
const exhaustion=require('../utils/exhausted-wagering');
const {creditApprovedDeposit}=require('../utils/deposit-credit');
const {migration}=require('./apply-bonus400-v1.cjs');
const {progress}=require('../utils/account-dashboard');
const tipWagering=require('../utils/tip-wagering');
const {units,decimal}=require('../utils/cashier-money');
async function run(){
 const host=process.env.GB_BONUS_QA_HOST||'127.0.0.1',port=Number(process.env.GB_BONUS_QA_PORT||3306);
 if(!['127.0.0.1','localhost','::1'].includes(host))throw Error('QA is restricted to loopback MySQL; no .env or remote application database is used.');
 const options={host,port,user:process.env.GB_BONUS_QA_USER||'root',password:process.env.GB_BONUS_QA_PASS||'',connectTimeout:15000};
 const db='gb_bonus400_qa_'+crypto.randomBytes(8).toString('hex');
 const all=[],checks=[];let admin,created=false;
 async function connect(){const c=await mysql.createConnection({...options,database:db});await c.query("SET SESSION sql_mode='ANSI_QUOTES,STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION'");all.push(c);return c;}
 const check=(name)=>{checks.push(name);console.log('PASS '+checks.length+': '+name);};
 try{
  admin=await mysql.createConnection(options);
  await admin.query('CREATE DATABASE `'+db+'` CHARACTER SET utf8mb4');created=true;
  const c=await connect();
  for(const table of JSON.parse(fs.readFileSync(path.join(__dirname,'bonus400-qa-schema.json'),'utf8')).tables)await c.query(table.ddl);
  await c.query('CREATE TABLE affiliates(userId BIGINT UNSIGNED NOT NULL,affiliateId BIGINT UNSIGNED NOT NULL,KEY byUser(userId)) ENGINE=InnoDB');
  await c.query("INSERT INTO siteFlags(name,value) VALUES ('gb_streamer_bonus_version','streamer-ftd-v2'),('gb_cashier_first_bet','1'),('gb_weighted_wager_first_bet_v1','1')");
  const [[identifierMode]]=await c.query('SELECT @@lower_case_table_names AS mode');console.log('Local MySQL table-name mode: '+identifierMode.mode);
  assert.equal((await migration(c)).changesRequired,5);
  await assert.rejects(()=>bonus.ensureReady(c),e=>e.publicError==='BONUS_NOT_READY');
  await migration(c,{apply:true});assert.equal((await migration(c,{apply:true})).changesApplied,0);
  const [[base]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_streamer_bonus_version'");assert.equal(base.value,'streamer-ftd-v2');
  check('Real CHECK/rate/closure migration succeeds and reruns without changing the base marker');
  async function user(balance='0.00',required='0.00',earned='0.00',extra={}){
   const id=crypto.randomBytes(7).toString('hex');
   const [row]=await c.query('INSERT INTO users(username,email,passwordHash,balance,wagerRequirement,wagerProgress,role,banned,accountLock,sponsorLock) VALUES (?,?,?,?,?,?,?,?,?,?)',['qa_'+id,id+'@example.invalid','QA_NOT_A_REAL_LOGIN',balance,required,earned,extra.role||'USER',extra.banned||0,extra.accountLock||0,extra.sponsorLock||0]);
   return row.insertId;
  }
  const streamer=await user('0','0','0',{role:'STREAMER'});await c.query("UPDATE users SET affiliateCode='QA400' WHERE id=?",[streamer]);
  async function deposit(uid,amount='50.00',status='pending',type='crypto_deposit',method='crypto_manual'){
   const [row]=await c.query('INSERT INTO transactions(userId,amount,type,method,status) VALUES (?,?,?,?,?)',[uid,amount,type,method,status]);
   return {id:row.insertId,userId:uid,amount,type,status};
  }
  async function old(uid,remaining='70.00',type='crypto_deposit',amount='100.00'){
   const t=await deposit(uid,amount,'approved',type,type==='in'?'tip':'crypto_manual');
   await c.query('INSERT INTO cashierDepositWagers(transactionId,userId,amount,remaining,firstBetId) VALUES (?,?,?,?,1)',[t.id,uid,'100.00',remaining]);return t;
  }
  async function tx(connection,fn){await connection.beginTransaction();try{const result=await fn(connection);await connection.commit();return result;}catch(e){await connection.rollback();throw e;}}
  async function state(uid){const [[u]]=await c.query('SELECT CAST(balance AS CHAR) AS balance,CAST(wagerRequirement AS CHAR) AS required,CAST(wagerProgress AS CHAR) AS progress,xp FROM users WHERE id=?',[uid]);return u;}
  const uid=await user(),first=await deposit(uid);await c.query('INSERT INTO affiliates(userId,affiliateId) VALUES (?,?)',[uid,streamer]);
  await bonus.saveRequest(c,uid,first.id,first.amount,'QA400');
  const awarded=await tx(c,x=>creditApprovedDeposit(x,first));
  assert.equal(awarded.award.bonus,'200.00');assert.equal(awarded.award.required,'10000.00');assert.equal((await state(uid)).balance,'250.00');
  await assert.rejects(()=>tx(c,x=>creditApprovedDeposit(x,first)));
  const [[awardCount]]=await c.query('SELECT COUNT(*) AS n FROM depositBonusAwards WHERE userId=?',[uid]);assert.equal(Number(awardCount.n),1);
  check('$50 new 40x approval credits $250 once, records $10000 and refuses a repeated approval');
  const badUser=await user(),badTx=await deposit(badUser);
  await assert.rejects(()=>c.query('INSERT INTO depositBonusRequests(transactionId,userId,code,version,rate,bonusAmount,wagerAmount) VALUES (?,?,?,?,?,?,?)',[badTx.id,badUser,'QA400','streamer-ftd-v3-5x',400,'200.00','6250.00']));
  await assert.rejects(()=>c.query('INSERT INTO depositBonusRequests(transactionId,userId,code,version,rate,bonusAmount,wagerAmount) VALUES (?,?,?,?,?,?,?)',[badTx.id,badUser,'QA400',bonus.VERSION,400,'50000.01','6250.00']));
  check('MySQL rejects historical-version rate 400 and a bonus over $50000');
  for(const version of ['streamer-ftd-v4-400-25x','streamer-ftd-v3-5x','streamer-ftd-v2','jammy-ftd-v1']){
   const historicalAmount=version==='streamer-ftd-v4-400-25x'?'50.00':'40.00';const u=await user(),t=await deposit(u,historicalAmount),code=version==='jammy-ftd-v1'?'JAMMMY':'QA400',q=bonus.calculate(historicalAmount,code,version);
   await c.query('INSERT INTO depositBonusRequests(transactionId,userId,code,version,rate,bonusAmount,wagerAmount,streamerId) VALUES (?,?,?,?,?,?,?,?)',[t.id,u,code,version,q.rate,q.bonus,q.required,version==='jammy-ftd-v1'?null:streamer]);
   const result=await tx(c,x=>creditApprovedDeposit(x,t));assert.equal(result.award.required,q.required);assert.equal((await state(u)).balance,q.creditedTotal);
   check('Pending '+version+' approval preserves saved bonus and multiplier');
  }
  const exhausted=await user('0.00','100.00','30.00'),prior=await old(exhausted),next=await deposit(exhausted);
  await c.query('INSERT INTO cashierWagerRemainders(userId,transactionId,halfCent) VALUES (?,?,1),(?,0,1)',[exhausted,prior.id,exhausted]);
  const closed=await tx(c,x=>creditApprovedDeposit(x,next));assert.equal(closed.closure.waived,'70.00');
  assert.deepEqual(await state(exhausted),{balance:'50.00',required:'150.00',progress:'100.00',xp:0});
  assert.equal(await exhaustion.summary(c,exhausted),'70.00');assert.equal(progress('150.00','50.00','70.00').completed,'30.00');
  const [[carries]]=await c.query('SELECT COUNT(*) AS n FROM cashierWagerRemainders WHERE userId=?',[exhausted]);assert.equal(Number(carries.n),0);
  const [requirements]=await c.query('SELECT CAST(remaining AS CHAR) AS remaining FROM cashierDepositWagers WHERE userId=? ORDER BY transactionId',[exhausted]);assert.deepEqual(requirements.map(r=>r.remaining),['0.00','50.00']);
  check('Exhaustion closes only old $70, clears old carries, preserves actual $30 and gives new $50 its own 1x requirement');
  assert.equal((await bonus.readEligibility(c,exhausted)).eligible,false);
  check('Exhaustion does not renew first-deposit eligibility');
  async function blocked(name,setup,reason){
   const u=await user('0.00','100.00','30.00');await old(u);const t=await deposit(u);await setup(u,t);
   const result=await tx(c,x=>exhaustion.closeIfExhausted(x,u,t.id));assert.equal(result.waived,'0.00');assert.equal(result.reason,reason);assert.equal((await state(u)).progress,'30.00');check(name);
  }
  await blocked('Positive cash blocks closure',u=>c.query('UPDATE users SET balance=0.01 WHERE id=?',[u]),'BALANCE_REMAINS');
  await blocked('Incomplete bet blocks closure',u=>c.query("INSERT INTO bets(userId,amount,game,gameId,completed) VALUES (?,1,'roulette',1,0)",[u]),'UNSETTLED_BET');
  await blocked('Unfinished Mines record blocks closure',u=>c.query("INSERT INTO mines(userId,amount,clientSeedId,serverSeedId,nonce,minesCount,mines,revealedTiles) VALUES (?,1,1,1,1,1,'[]','[]')",[u]),'ACTIVE_MINES');
  await blocked('Unsettled Coinflip record blocks closure',u=>c.query("INSERT INTO coinflips(ownerId,amount,serverSeed) VALUES (?,1,'fixture')",[u]),'ACTIVE_COINFLIP');
  await blocked('Battle participation blocks closure',async u=>{const [b]=await c.query("INSERT INTO battles(ownerId,entryPrice,gamemode,serverSeed) VALUES (?,1,'normal','fixture')",[streamer]);await c.query('INSERT INTO battlePlayers(battleId,userId,slot,team) VALUES (?,?,1,1)',[b.insertId,u]);},'ACTIVE_BATTLE');
  await blocked('Valuable unsold inventory blocks closure',u=>c.query("INSERT INTO inventory(userId,openingId,caseItemId,name,img,price) VALUES (?, ?,1,'fixture','fixture',1)",[u,u]),'INVENTORY_REMAINS');
  await blocked('Pending withdrawal blocks closure',u=>deposit(u,'15.00','pending','crypto_withdraw'),'WITHDRAWAL_PENDING');
  await blocked('Processing withdrawal blocks closure',u=>deposit(u,'15.00','processing','crypto_withdraw'),'WITHDRAWAL_PENDING');
  await blocked('Four-decimal slots remainder blocks closure',u=>c.query('INSERT INTO gbSlotWalletRemainders(userId,units) VALUES (?,1)',[u]),'SLOT_FRACTION_REMAINS');
  await blocked('Open slots round blocks closure',u=>c.query("INSERT INTO gbSlotRounds(appId,roundId,userId,gameId,currency,closed) VALUES ('qa',?,?, 'fixture','USD',0)",[String(u),u]),'SLOT_ROUND_OPEN');
  for(const [field,value] of [['role','BOT'],['banned',1],['accountLock',1],['sponsorLock',1]])await blocked(field+' restriction blocks closure',u=>c.query('UPDATE users SET '+field+'=? WHERE id=?',[value,u]),'ACCOUNT_RESTRICTED');
  const mixed=await user('0.00','150.00','30.00');const m=await old(mixed,'70.00','in','20.00');const mt=await deposit(mixed);
  await tx(c,x=>creditApprovedDeposit(x,mt));
  const [rows]=await c.query('SELECT CAST(requirementTransactionId AS CHAR) AS id,CAST(waivedAmount AS CHAR) AS waived FROM cashierWagerClosures WHERE userId=? ORDER BY requirementTransactionId',[mixed]);assert.deepEqual(rows,[{id:'0',waived:'50.00'},{id:String(m.id),waived:'70.00'}]);
  const tip=await tipWagering.progress(c,mixed);assert.equal(tip.waived,'70.00');assert.equal(tip.actualProgress,'30.00');assert.equal(await exhaustion.summary(c,mixed),'120.00');
  check('Tracked tips and untracked legacy obligations are audited separately without fabricated tip progress');
  const rollback=await user('0.00','100.00','30.00');await old(rollback);const rt=await deposit(rollback);
  await assert.rejects(()=>tx(c,async x=>{await creditApprovedDeposit(x,rt);throw Error('Injected after helper, before commit');}));
  assert.deepEqual(await state(rollback),{balance:'0.00',required:'100.00',progress:'30.00',xp:0});assert.equal(await exhaustion.summary(c,rollback),'0.00');
  const [[rs]]=await c.query('SELECT status FROM transactions WHERE id=?',[rt.id]);assert.equal(rs.status,'pending');
  await tx(c,x=>creditApprovedDeposit(x,rt));assert.equal((await state(rollback)).balance,'50.00');
  check('Real MySQL rollback removes closure, credit and approval; retry applies exactly once');
  const bonusRollback=await user(),br=await deposit(bonusRollback);await c.query('INSERT INTO affiliates(userId,affiliateId) VALUES (?,?)',[bonusRollback,streamer]);await bonus.saveRequest(c,bonusRollback,br.id,br.amount,'QA400');
  await assert.rejects(()=>tx(c,async x=>{await creditApprovedDeposit(x,br);throw Error('Injected after bonus ledger and balance credit');}));
  const [[brAwards]]=await c.query('SELECT COUNT(*) AS n FROM depositBonusAwards WHERE userId=?',[bonusRollback]);const [[brLedger]]=await c.query("SELECT COUNT(*) AS n FROM transactions WHERE userId=? AND type='bonus_credit'",[bonusRollback]);const [[brRequest]]=await c.query('SELECT status FROM depositBonusRequests WHERE transactionId=?',[br.id]);
  assert.equal(Number(brAwards.n),0);assert.equal(Number(brLedger.n),0);assert.equal(brRequest.status,'pending');assert.equal((await state(bonusRollback)).balance,'0.00');await tx(c,x=>creditApprovedDeposit(x,br));assert.equal((await state(bonusRollback)).balance,'250.00');
  check('Bonus award, bonus ledger, request status and balance roll back together; retry awards once');
  const a=await connect(),b=await connect();
  const dualBonus=await user();await c.query('INSERT INTO affiliates(userId,affiliateId) VALUES (?,?)',[dualBonus,streamer]);const bonus1=await deposit(dualBonus),bonus2=await deposit(dualBonus);await bonus.saveRequest(c,dualBonus,bonus1.id,bonus1.amount,'QA400');await bonus.saveRequest(c,dualBonus,bonus2.id,bonus2.amount,'QA400');
  const dualResults=await Promise.all([tx(a,x=>creditApprovedDeposit(x,bonus1)),tx(b,x=>creditApprovedDeposit(x,bonus2))]);assert.equal(dualResults.filter(r=>r.award.status==='awarded').length,1);assert.equal(dualResults.filter(r=>r.award.status==='ineligible').length,1);assert.equal((await state(dualBonus)).balance,'300.00');assert.equal((await state(dualBonus)).required,'10050.00');
  check('Concurrent pending first-deposit claims award the bonus only to the first approved deposit');
  const concurrent=await user('0.00','100.00','30.00');await old(concurrent);const ct=await deposit(concurrent);
  const results=await Promise.allSettled([tx(a,x=>creditApprovedDeposit(x,ct)),tx(b,x=>creditApprovedDeposit(x,ct))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await state(concurrent)).balance,'50.00');assert.equal(await exhaustion.summary(c,concurrent),'70.00');
  check('Concurrent duplicate approval commits one credit and one closure');
  const distinct=await user('0.00','100.00','30.00');await old(distinct);const d1=await deposit(distinct),d2=await deposit(distinct);
  await Promise.all([tx(a,x=>creditApprovedDeposit(x,d1)),tx(b,x=>creditApprovedDeposit(x,d2))]);assert.deepEqual(await state(distinct),{balance:'100.00',required:'200.00',progress:'100.00',xp:0});assert.equal(await exhaustion.summary(c,distinct),'70.00');
  check('Concurrent distinct approvals preserve both new requirements and close old funding only once');
  const stale=await user('0.00','100.00','30.00');await old(stale);const st=await deposit(stale);
  await b.beginTransaction();await b.query('SELECT * FROM gbSlotRounds WHERE userId=?',[stale]);
  await tx(a,async x=>{await x.query('SELECT id FROM users WHERE id=? FOR UPDATE',[stale]);await x.query("INSERT INTO gbSlotRounds(appId,roundId,userId,gameId,currency,closed) VALUES ('qa',?,?,'fixture','USD',0)",[String(stale),stale]);});
  assert.equal((await exhaustion.closeIfExhausted(b,stale,st.id)).reason,'SLOT_ROUND_OPEN');await b.rollback();
  check('Locking current reads see an open slots round despite an older transaction snapshot');
  const inconsistent=await user('0.00','100.00','80.00');await old(inconsistent);const it=await deposit(inconsistent);
  await assert.rejects(()=>tx(c,x=>creditApprovedDeposit(x,it)));assert.equal((await state(inconsistent)).progress,'80.00');
  const wrong=await user();await assert.rejects(()=>tx(c,x=>exhaustion.closeIfExhausted(x,wrong,it.id)));
  check('Inconsistent totals and wrong-player triggers refuse closure atomically');
  const {Wallet}=require('../slots/wallet.cjs'),{money:slotMoney}=require('../slots/protocol.cjs');
  let injectSlotFailure=false;
  const wallet=new Wallet({getConnection:async()=>{const x=await connect();const query=x.query.bind(x);x.query=async(q,p)=>{if(injectSlotFailure&&q.startsWith('UPDATE cashierBonusSlotCredits SET credited'))throw Error('INJECTED_SLOT_ROLLBACK');return query(q,p);};x.release=()=>{};return x;}},{enabled:true,maxBet:10000n,currency:'USD'});
  async function eligibleSlotUser(version=bonus.VERSION){const u=await user('0','0','0',{role:'ADMIN'}),t=await deposit(u);await c.query('INSERT INTO affiliates(userId,affiliateId) VALUES (?,?)',[u,streamer]);const q=bonus.calculate(t.amount,'QA400',version);await c.query('INSERT INTO depositBonusRequests(transactionId,userId,code,version,rate,bonusAmount,wagerAmount,streamerId) VALUES (?,?,?,?,?,?,?,?)',[t.id,u,'QA400',version,q.rate,q.bonus,q.required,streamer]);await tx(c,x=>creditApprovedDeposit(x,t));await c.query("INSERT INTO gbSlotSessions(userId,gameId,currency,state) VALUES (?,'fixture','USD','launched')",[u]);return u;}
  function callback(u,id,round,reason,amount,end=false,ref){return {AppID:'qa',UserID:String(u),TransactionID:id,RoundID:round,Reason:reason,GameID:'fixture',Amount:amount,IsEnd:end,Currency:'USD',...(ref?{RefTransactionID:ref}: {})};}
  const su=await eligibleSlotUser();const sb=callback(su,'new|bet','new-round','bet','-1.0000');assert.equal((await wallet.transfer(sb,slotMoney(sb.Amount))).code,0);assert.equal((await state(su)).progress,'0.00');
  const sw=callback(su,'new|end','new-round','win','0.0000',true);assert.equal((await wallet.transfer(sw,0n)).code,0);assert.equal((await state(su)).progress,'1.00');await wallet.transfer(sw,0n);assert.equal((await state(su)).progress,'1.00');
  check('New 40x claim: a completed $1 slots wager earns $1, open rounds earn none, duplicate callback cannot credit twice');
  const ou=await eligibleSlotUser('streamer-ftd-v4-400-25x');const ob=callback(ou,'old|bet','old-round','bet','-1.0000'),ow=callback(ou,'old|end','old-round','win','0.0000',true);await wallet.transfer(ob,-10000n);await wallet.transfer(ow,0n);assert.equal((await state(ou)).progress,'0.00');assert.equal((await state(ou)).required,'6250.00');
  check('Accepted 25x claim keeps its recorded 25x requirement and zero slots contribution');
  const ru=await eligibleSlotUser(),rb=callback(ru,'refund|bet','refund-round','bet','-1.0000'),rr=callback(ru,'refund|return','refund-round','refund','1.0000',true,'refund|bet');await wallet.transfer(rb,-10000n);await wallet.transfer(rr,10000n);assert.equal((await state(ru)).progress,'0.00');assert.equal((await state(ru)).balance,'250.00');
  check('Refunded stake creates no slots wagering credit');
  const du=await eligibleSlotUser();for(let i=0;i<2;i++){const d=callback(du,'dust|'+i,'dust-round-'+i,'bet','-0.0050',true);await wallet.transfer(d,-50n);}assert.equal((await state(du)).progress,'0.01');
  check('Two half-cent completed slots stakes earn exactly one cent for the same new bonus');
  const nu=await user('10.00','10.00','0.00',{role:'ADMIN'});await c.query("INSERT INTO gbSlotSessions(userId,gameId,currency,state) VALUES (?,'fixture','USD','launched')",[nu]);const nb=callback(nu,'ordinary|bet','ordinary-round','bet','-1.0000',true);await wallet.transfer(nb,-10000n);assert.equal((await state(nu)).progress,'0.00');
  check('Slots do not credit ordinary deposits or create a bonus entitlement');
  const bu=await eligibleSlotUser(),bb=callback(bu,'atomic|bet','atomic-round','bet','-1.0000',true);injectSlotFailure=true;await assert.rejects(()=>wallet.transfer(bb,-10000n));injectSlotFailure=false;assert.equal((await state(bu)).balance,'250.00');assert.equal((await state(bu)).progress,'0.00');await wallet.transfer(bb,-10000n);assert.equal((await state(bu)).progress,'1.00');
  check('Slots wallet debit, callback ledger and bonus progress roll back together, then retry once');
  const cu=await eligibleSlotUser(),cb=callback(cu,'concurrent|bet','concurrent-round','bet','-1.0000',true);await Promise.all([wallet.transfer(cb,-10000n),wallet.transfer(cb,-10000n)]);assert.equal((await state(cu)).balance,'249.00');assert.equal((await state(cu)).progress,'1.00');
  check('Concurrent duplicate slots callbacks debit and credit wagering only once');
  return {status:'PASS_ISOLATED_MYSQL_BONUS400',checks:checks.length,applicationTablesTouched:false,providerRequests:0};
 }finally{
  for(const c of all)await c.end().catch(()=>{});
  if(admin){if(created){if(!/^gb_bonus400_qa_[a-f0-9]{16}$/.test(db))throw Error('Invalid fixture schema cleanup name');await admin.query('DROP DATABASE `'+db+'`');console.log('Removed isolated QA database.');}await admin.end();}
 }
}
if(require.main===module)run().then(result=>console.log(JSON.stringify(result))).catch(e=>{if(e.schemaDiagnostic)console.error('Schema preflight detail:',JSON.stringify(e.schemaDiagnostic));console.error('Isolated QA failed:',e.stack||e.message);process.exitCode=1;});
module.exports={run};
