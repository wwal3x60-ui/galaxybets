'use strict';
const {settle}=require('./retire-core.cjs');
const VERSION='gb-legacy-retire-v1';let controller,databaseFingerprint=null;
async function fingerprint(pool){const[[row]]=await pool.query('SELECT DATABASE() db,@@server_uuid serverId');if(!row.db||!row.serverId)throw Error('DATABASE_IDENTITY_UNAVAILABLE');return require('node:crypto').createHash('sha256').update(JSON.stringify([VERSION,row.db,row.serverId])).digest('hex');}
const ddl=[`CREATE TABLE IF NOT EXISTS legacyBattleRetirements(battleId BIGINT UNSIGNED NOT NULL PRIMARY KEY,ownerId BIGINT UNSIGNED NOT NULL,createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,`CREATE TABLE IF NOT EXISTS legacyBattleRefunds(battleId BIGINT UNSIGNED NOT NULL,userId BIGINT UNSIGNED NOT NULL,amount DECIMAL(18,2) NOT NULL,createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(battleId,userId)) ENGINE=InnoDB`];
async function run(pool,quote){
 const c=await pool.getConnection();let locked=false;
 try{const[[lock]]=await c.query("SELECT GET_LOCK('gb-legacy-retire-v1',0) AS acquired");if(Number(lock.acquired)!==1)return{busy:true};locked=true;databaseFingerprint=await fingerprint(c);
 for(const statement of ddl)await c.query(statement);
 const[tables]=await c.query("SELECT TABLE_NAME name,ENGINE engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('users','battles','bets','transactions','battlePlayers','battleRounds','caseVersions','legacyBattleRetirements','legacyBattleRefunds')");if(tables.length!==9||tables.some(t=>String(t.engine).toUpperCase()!=='INNODB'))throw Error('REFUND_TABLES_MUST_BE_INNODB');
 const[rows]=await c.query('SELECT id FROM battles WHERE endedAt IS NULL AND cancelledAt IS NULL ORDER BY id');let refunded=0;const review=[];
 for(const row of rows){try{const result=await settle(c,String(row.id),quote);if(!result.skipped)refunded++;}catch(e){review.push({battleId:String(row.id),reason:e.message});}}
 if(rows.length)console.log('[Battle retirement]',JSON.stringify({version:VERSION,cancelledAndRefunded:refunded,review}));return{refunded,review};
 }finally{if(locked)await c.query("SELECT RELEASE_LOCK('gb-legacy-retire-v1')").catch(()=>{});c.release();}
}
function start({pool,quote}){if(controller)return controller;let busy=false,stopped=false;const tick=async()=>{if(stopped||busy)return;busy=true;try{await run(pool,quote);}catch(e){console.error('[Battle retirement] retry pending:',e.code||e.message);}finally{busy=false;}};void tick();const timer=setInterval(()=>void tick(),30000);timer.unref();controller={stop(){stopped=true;clearInterval(timer);}};return controller;}
module.exports={VERSION,start,run,fingerprint,status:()=>({databaseFingerprint})};
async function history(pool,userId){
 const[[table]]=await pool.query("SELECT COUNT(*) n FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='legacyBattleRefunds'");if(Number(table.n)!==1)return{ready:false,total:'0.00',items:[]};
 const[[total]]=await pool.query('SELECT CAST(COALESCE(SUM(amount),0) AS CHAR) total FROM legacyBattleRefunds WHERE userId=?',[userId]);
 const[items]=await pool.query('SELECT CAST(battleId AS CHAR) battleId,CAST(amount AS CHAR) amount,createdAt FROM legacyBattleRefunds WHERE userId=? ORDER BY createdAt DESC,battleId DESC LIMIT 10',[userId]);return{ready:true,total:total.total,items};
}
module.exports.history=history;
