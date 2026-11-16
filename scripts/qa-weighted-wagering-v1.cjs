'use strict';
// Uses connection-local TEMPORARY fixture tables. They shadow production names
// only on this dedicated connection and disappear when it closes. No live DML.
require('dotenv').config();
const assert=require('node:assert/strict');
const {sql}=require('../database');
const wagering=require('../utils/cashier-wagering');
const tips=require('../utils/tip-wagering');
async function main(){
 const c=await sql.getConnection();let checks=0;
 const pass=name=>{checks++;console.log('PASS:',name)};
 try {
  const tables={
   siteFlags:'name VARCHAR(100) PRIMARY KEY,value VARCHAR(100)',
   users:"id BIGINT UNSIGNED PRIMARY KEY,role VARCHAR(30),wagerRequirement DECIMAL(18,2),wagerProgress DECIMAL(18,2)",
   bets:'id BIGINT UNSIGNED PRIMARY KEY,userId BIGINT UNSIGNED,game VARCHAR(40),gameId BIGINT UNSIGNED,amount DECIMAL(18,2),completed TINYINT',
   transactions:'id BIGINT UNSIGNED PRIMARY KEY,type VARCHAR(30),method VARCHAR(30),status VARCHAR(30),userId BIGINT UNSIGNED,amount DECIMAL(18,2)',
   cashierDepositWagers:'transactionId BIGINT UNSIGNED PRIMARY KEY,userId BIGINT UNSIGNED,amount DECIMAL(18,2),remaining DECIMAL(18,2),firstBetId BIGINT UNSIGNED',
   cashierWagerCredits:'betId BIGINT UNSIGNED PRIMARY KEY,userId BIGINT UNSIGNED,credited DECIMAL(18,2)',
   cashierWagerRemainders:'userId BIGINT UNSIGNED,transactionId BIGINT UNSIGNED,halfCent TINYINT UNSIGNED,PRIMARY KEY(userId,transactionId)'
  };
  // Do not start the tests unless ALL seven temporary shadows were created.
  for(const [name,definition] of Object.entries(tables))await c.query(`CREATE TEMPORARY TABLE ${name} (${definition}) ENGINE=InnoDB`);
  await c.query("INSERT INTO siteFlags VALUES ('gb_cashier_first_bet','1'),('gb_weighted_wager_first_bet_v1','100')");
  await c.query("INSERT INTO users VALUES (1,'USER',20,0)");
  await c.query("INSERT INTO transactions VALUES (1,'in','tip','approved',1,5)");
  await c.query('INSERT INTO cashierDepositWagers VALUES (1,1,20,20,100)');
  async function addBet(id,game,amount){await c.query('INSERT INTO bets VALUES (?,1,?,?,?,1)',[id,game,id,amount]);}
  async function settle(game,ids){await c.beginTransaction();try{await wagering.creditGameWagers(c,game,ids.map(String));await c.commit();}catch(e){await c.rollback();throw e;}}
  async function progress(){const [[u]]=await c.query('SELECT CAST(wagerProgress AS CHAR) AS progress FROM users WHERE id=1');return u.progress;}
  await addBet(100,'mines','0.01');await settle('mines',[100]);assert.equal(await progress(),'0.00');pass('First one-cent house wager retains half-cent');
  await settle('mines',[100]);const [[carry]]=await c.query('SELECT halfCent FROM cashierWagerRemainders WHERE userId=1 AND transactionId=1');assert.equal(Number(carry.halfCent),1);pass('Retry cannot double fractional credit');
  await addBet(101,'mines','0.01');await settle('mines',[101]);assert.equal(await progress(),'0.01');pass('Two one-cent house wagers credit exactly one cent');
  await addBet(102,'roulette','1.00');await settle('roulette',[102]);assert.equal(await progress(),'0.51');pass('House wager credits exactly 50 percent');
  await addBet(103,'case','1.00');await settle('case',[103]);assert.equal(await progress(),'1.51');pass('Packs credit 100 percent');
  await addBet(104,'battle','1.00');await settle('battle',[104]);assert.equal(await progress(),'2.51');pass('Battles credit 100 percent');
  await settle('case',[103]);await settle('battle',[104]);assert.equal(await progress(),'2.51');pass('Completed wager retries cannot re-credit');
  await addBet(105,'coinflip','1.01');await c.beginTransaction();await wagering.creditGameWagers(c,'coinflip',['105']);await c.rollback();assert.equal(await progress(),'2.51');const [[rolled]]=await c.query('SELECT COUNT(*) AS n FROM cashierWagerCredits WHERE betId=105');assert.equal(Number(rolled.n),0);pass('MySQL rollback removes progress and deduplication marker');
  await settle('coinflip',[105]);assert.equal(await progress(),'3.01');pass('Rolled-back settlement can retry once');
  await c.beginTransaction();const required=await tips.add(c,'1','2','2.50');await c.commit();assert.equal(required,'12.50');const [[row]]=await c.query('SELECT CAST(amount AS CHAR) AS amount,CAST(remaining AS CHAR) AS remaining,CAST(firstBetId AS CHAR) AS firstBetId FROM cashierDepositWagers WHERE transactionId=2');assert.equal(row.amount,'12.50');assert.equal(row.remaining,'12.50');assert.equal(row.firstBetId,'106');pass('New $2.50 tip creates exactly $12.50 forward-only requirement');
  console.log(JSON.stringify({status:'PASS_TEMPORARY_MYSQL',checks,liveTablesChanged:false,providerRequests:false}));
 } finally {
  try{await c.rollback();}catch{}
  // Destroy, rather than pool-release, guarantees temporary fixture removal.
  c.destroy();await sql.end();
 }
}
main().catch(e=>{console.error('Temporary-table QA failed:',e.code||e.message);process.exitCode=1;});
