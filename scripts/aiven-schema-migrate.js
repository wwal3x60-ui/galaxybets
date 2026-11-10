'use strict';
// Explicit remote target. No dotenv load and no use of the application's pool.
const fs=require('fs'),path=require('path');
const HOST='mysql-3dd690bd-galaxybets.h.aivencloud.com',PORT=11840,DB='defaultdb';
const core=[
`CREATE TABLE IF NOT EXISTS affiliateWallets(userId BIGINT UNSIGNED NOT NULL PRIMARY KEY,remainder DECIMAL(18,8) NOT NULL DEFAULT 0,available DECIMAL(18,2) NOT NULL DEFAULT 0,createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
`CREATE TABLE IF NOT EXISTS affiliateCommissions(id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,betId BIGINT UNSIGNED NOT NULL,affiliateId BIGINT UNSIGNED NOT NULL,referredUserId BIGINT UNSIGNED NOT NULL,edgeAmount DECIMAL(18,2) NOT NULL,commissionRate DECIMAL(8,4) NOT NULL,commissionAmount DECIMAL(20,8) NOT NULL,balanceCredit DECIMAL(18,2) NOT NULL DEFAULT 0,createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE KEY uq_affiliate_bet(betId),KEY idx_affiliate_owner(affiliateId,betId),KEY idx_affiliate_referred(referredUserId,betId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
`CREATE TABLE IF NOT EXISTS inventory(id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,userId BIGINT UNSIGNED NOT NULL,openingId BIGINT UNSIGNED NOT NULL,caseItemId BIGINT UNSIGNED NOT NULL,name VARCHAR(255) NOT NULL,img MEDIUMTEXT,price DECIMAL(18,2) NOT NULL,status VARCHAR(16) NOT NULL DEFAULT 'AVAILABLE',createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,soldAt DATETIME NULL,UNIQUE KEY uq_inventory_opening(openingId),KEY idx_inventory_user(userId,status,id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`
];
async function plan(c){
 const [[server]]=await c.query('SELECT DATABASE() AS db,@@lower_case_table_names AS caseMode');if(server.db!==DB||Number(server.caseMode)!==0)throw Error('Unexpected database or table casing mode. No changes applied.');
 const [dupes]=await c.query('SELECT userId,COUNT(*) AS n FROM affiliates GROUP BY userId HAVING COUNT(*)>1');if(dupes.length)throw Error('Duplicate referral relationships require explicit review. No changes applied.');
 const [rows]=await c.query('SHOW TABLES');const names=rows.map(r=>String(Object.values(r)[0]));
 const [uc]=await c.query('SHOW COLUMNS FROM users'),[ac]=await c.query('SHOW COLUMNS FROM affiliates');
 const [ix]=await c.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND BINARY TABLE_NAME=BINARY 'affiliates' AND NON_UNIQUE=0 GROUP BY INDEX_NAME HAVING COUNT(*)=1 AND MAX(COLUMN_NAME)='userId'");
 let cutoff;const [[max]]=await c.query('SELECT CAST(COALESCE(MAX(id),0)+1 AS CHAR) AS cutoff FROM bets');cutoff=String(max.cutoff);
 const [[saved]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_affiliate_activation_bet'");if(saved){if(!/^[1-9]\d*$/.test(saved.value))throw Error('Invalid persisted rollout boundary');cutoff=saved.value;}
 const tables=[...core,...require('../utils/aiven-extra-tables.json')];
 for(const text of tables){const name=text.match(/EXISTS\s+(\w+)/i)[1];if(names.some(n=>n.toLowerCase()===name.toLowerCase()&&n!==name))throw Error('Case conflict on new table '+name);}
 const community=await require('../utils/feature-schema').migrate(c,false),expansion=await require('../utils/expansion-schema').migrate(c,false);
 return {host:HOST,port:PORT,database:DB,cutoff,cutoffPersisted:!!saved,addProfilePhoto:!uc.some(x=>x.Field==='profilePhoto'),addReferralBoundary:!ac.some(x=>x.Field==='firstBetId'),addUniqueReferral:!ix.length,coreMissing:tables.map(t=>t.match(/EXISTS\s+(\w+)/i)[1]).filter(n=>!names.includes(n)),community,expansion};
}
async function apply(c,p){
 // Called only with all backend/worker writes stopped. The stored cutoff is never recalculated on reruns.
 await c.query("INSERT INTO siteFlags(name,value) VALUES('gb_affiliate_activation_bet',?) ON DUPLICATE KEY UPDATE name=name",[p.cutoff]);
 const [[saved]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_affiliate_activation_bet'");if(String(saved.value)!==p.cutoff)throw Error('Rollout boundary changed; stop and review.');
 if(p.addProfilePhoto)await c.query('ALTER TABLE users ADD COLUMN profilePhoto MEDIUMTEXT NULL');
 if(p.addReferralBoundary)await c.query('ALTER TABLE affiliates ADD COLUMN firstBetId BIGINT UNSIGNED NOT NULL DEFAULT '+p.cutoff);
 if(p.addUniqueReferral)await c.query('ALTER TABLE affiliates ADD UNIQUE KEY uq_affiliates_userId(userId)');
 for(const ddl of [...core,...require('../utils/aiven-extra-tables.json')])await c.query(ddl);
 await require('../utils/feature-schema').migrate(c,true);await require('../utils/expansion-schema').migrate(c,true);
 const after=await plan(c);if(after.addProfilePhoto||after.addReferralBoundary||after.addUniqueReferral||after.coreMissing.length||after.community.missingTables.length||after.community.battleColumns.length||after.expansion.missingTables.length||after.expansion.battleColumns.length)throw Error('Schema incomplete. Keep backend stopped.');
 return after;
}
async function main(){const args=process.argv.slice(2),get=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]},applying=args.includes('--apply');
 const ca=get('--ca');if(!ca||!fs.existsSync(ca))throw Error('Provide --ca with the Aiven CA file.');
 if(!process.env.GB_AIVEN_PASSWORD)throw Error('Password must be supplied by the PowerShell runner.');
 if(applying){if(!args.includes('--backend-stopped'))throw Error('Stop Render backend, workers and local remote-connected processes first.');const file=get('--backup');if(!file||!fs.existsSync(file)||fs.statSync(file).size<1000)throw Error('Provide the verified remote backup path.');const fd=fs.openSync(file,'r'),size=fs.statSync(file).size,b=Buffer.alloc(Math.min(size,4096));fs.readSync(fd,b,0,b.length,Math.max(0,size-b.length));fs.closeSync(fd);if(!b.toString().includes('Dump completed on'))throw Error('Backup completion footer missing. Create and verify a fresh dump.');}
 const c=await require('mysql2/promise').createConnection({host:HOST,port:PORT,database:DB,user:process.env.GB_AIVEN_USER||'avnadmin',password:process.env.GB_AIVEN_PASSWORD,ssl:{ca:fs.readFileSync(ca,'utf8'),rejectUnauthorized:true},connectTimeout:20000});
 try{const p=await plan(c);console.log(JSON.stringify({mode:applying?'apply':'READ-ONLY PREVIEW',...p},null,2));if(applying){console.log('Applying additive schema changes. MySQL DDL is not fully transactional.');const after=await apply(c,p);console.log('Schema ready. Preserve this Render setting: AFFILIATE_FIRST_ELIGIBLE_BET_ID='+after.cutoff);console.log('Pack catalog, backend code, bot funding and launch blockers still require deployment checks. No existing balance/history rows were changed.');}else console.log('No database changes made. Do not deploy the backend yet.');}finally{await c.end();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});module.exports={plan,apply,core};
