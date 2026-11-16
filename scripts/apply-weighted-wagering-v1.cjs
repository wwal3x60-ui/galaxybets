'use strict';
// Run with backend processes stopped, from the backend project directory.
require('dotenv').config();
const {sql}=require('../database');
async function main(){
 const c=await sql.getConnection();let transaction=false;
 try {
  await c.query('SELECT transactionId,userId,remaining,firstBetId FROM cashierDepositWagers LIMIT 0');
  await c.query('SELECT betId,userId,credited FROM cashierWagerCredits LIMIT 0');
  await c.query('SELECT wagerRequirement,wagerProgress FROM users LIMIT 0');
  const [[base]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_cashier_first_bet'");
  if(!base||!/^[1-9]\d*$/.test(String(base.value)))throw Error('Existing cashier wagering schema is missing. No policy activation performed.');
  await c.query(`CREATE TABLE IF NOT EXISTS cashierWagerRemainders (
   userId BIGINT UNSIGNED NOT NULL,
   transactionId BIGINT UNSIGNED NOT NULL,
   halfCent TINYINT UNSIGNED NOT NULL DEFAULT 0,
   PRIMARY KEY(userId,transactionId),
   CONSTRAINT chk_cashier_half_cent CHECK(halfCent IN (0,1))
  ) ENGINE=InnoDB`);
  await c.query('SELECT userId,transactionId,halfCent FROM cashierWagerRemainders LIMIT 0');
  await c.beginTransaction();transaction=true;
  const [[last]]=await c.query('SELECT CAST(id AS CHAR) AS id FROM bets ORDER BY id DESC LIMIT 1 FOR UPDATE');
  const first=(BigInt(last?.id||'0')+1n).toString();
  await c.query("INSERT IGNORE INTO siteFlags(name,value) VALUES ('gb_weighted_wager_first_bet_v1',?)",[first]);
  const [[active]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_weighted_wager_first_bet_v1' FOR UPDATE");
  if(!/^[1-9]\d*$/.test(String(active?.value)))throw Error('Invalid existing weighted wagering boundary');
  // Only existing, implemented games are enabled. No unfinished Blackjack handler is activated.
  await c.query("UPDATE features SET enabled=1 WHERE id IN ('mines','roulette','jackpot','coinflip','crash')");
  await c.query("UPDATE features SET enabled=0 WHERE id='keno'");
  await c.commit();transaction=false;
  const [features]=await c.query("SELECT id,enabled FROM features WHERE id IN ('mines','roulette','jackpot','coinflip','crash','keno') ORDER BY id");
  console.log(JSON.stringify({status:'WEIGHTED_WAGERING_V1_READY',firstWeightedBetId:String(active.value),features,balanceChanges:false,historicalRequirementsChanged:false},null,2));
 } catch(e){if(transaction)try{await c.rollback();}catch{}throw e;}
 finally{c.release();await sql.end();}
}
main().catch(e=>{console.error('Migration failed:',e.code||e.message);process.exitCode=1;});
