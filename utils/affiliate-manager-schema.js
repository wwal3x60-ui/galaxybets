'use strict';
const VERSION='affiliate-managers-v1';
const statements=[
`CREATE TABLE IF NOT EXISTS affiliateManagerWallets (
 managerId BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 budget DECIMAL(18,2) NOT NULL DEFAULT 0,
 granted DECIMAL(18,2) NOT NULL DEFAULT 0,
 commissionEarned DECIMAL(30,10) NOT NULL DEFAULT 0,
 commissionClaimed DECIMAL(30,10) NOT NULL DEFAULT 0,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 CONSTRAINT chk_manager_wallet CHECK(budget>=0 AND granted>=0 AND commissionEarned>=commissionClaimed AND commissionClaimed>=0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS affiliateManagerStreamers (
 streamerId BIGINT UNSIGNED NOT NULL PRIMARY KEY,managerId BIGINT UNSIGNED NULL,
 firstBetId BIGINT UNSIGNED NULL,assignedAt DATETIME(3) NULL,
 notes VARCHAR(500) NOT NULL DEFAULT '',
 KEY idx_manager_streamers(managerId,streamerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS affiliateManagerCommissions (
 betId BIGINT UNSIGNED NOT NULL PRIMARY KEY,managerId BIGINT UNSIGNED NOT NULL,
 streamerId BIGINT UNSIGNED NOT NULL,affiliateAmount DECIMAL(28,8) NOT NULL,
 managerAmount DECIMAL(30,10) NOT NULL,createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_manager_commissions(managerId,streamerId,betId),
 CONSTRAINT chk_manager_commission CHECK(affiliateAmount>0 AND managerAmount>0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS affiliateManagerRequests (
 actorId BIGINT UNSIGNED NOT NULL,requestId VARCHAR(64) NOT NULL,kind VARCHAR(32) NOT NULL,
 payloadHash CHAR(64) NOT NULL,result JSON NULL,createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(actorId,requestId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
`CREATE TABLE IF NOT EXISTS affiliateManagerEvents (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,actorId BIGINT UNSIGNED NOT NULL,
 managerId BIGINT UNSIGNED NOT NULL,streamerId BIGINT UNSIGNED NULL,
 kind VARCHAR(32) NOT NULL,amount DECIMAL(30,10) NOT NULL DEFAULT 0,
 note VARCHAR(500) NOT NULL DEFAULT '',requestId VARCHAR(64) NOT NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 KEY idx_manager_events(managerId,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
];
const required={affiliateManagerWallets:['managerId','budget','granted','commissionEarned','commissionClaimed'],affiliateManagerStreamers:['streamerId','managerId','firstBetId','assignedAt','notes'],affiliateManagerCommissions:['betId','managerId','streamerId','affiliateAmount','managerAmount'],affiliateManagerRequests:['actorId','requestId','kind','payloadHash','result'],affiliateManagerEvents:['id','actorId','managerId','streamerId','kind','amount','note','requestId']};
function roleMigration(column){
 const type=String(column.Type||'');const varchar=/^varchar\((\d+)\)$/i.test(type);
 if(varchar&&Number(type.match(/\d+/)[0])>=17)return null;
 if(varchar){
  if(column.Extra||column.Collation)throw Error('An extended role column needs review.');
  const nullable=column.Null==='YES'?'NULL':'NOT NULL';
  const def=column.Default==null?(column.Null==='YES'?' DEFAULT NULL':''):' DEFAULT '+"'"+String(column.Default).replace(/\\/g,'\\\\').replace(/'/g,"''")+"'";
  return 'ALTER TABLE users MODIFY COLUMN role VARCHAR(32) '+nullable+def;
 }
 if(!/^enum\((?:'(?:[^'\\]|\\.)*',?)+\)$/i.test(type))throw Error('Unsupported users.role type; no role column changed.');
 if(type.includes("'AFFILIATE_MANAGER'"))return null;
 const nullable=column.Null==='YES'?'NULL':'NOT NULL';
 const defaultValue=column.Default==null?(column.Null==='YES'?' DEFAULT NULL':''):' DEFAULT '+"'"+String(column.Default).replace(/'/g,"''")+"'";
 if(column.Extra||column.Collation)throw Error('An extended role column needs review.');
 return 'ALTER TABLE users MODIFY COLUMN role '+type.slice(0,-1)+",'AFFILIATE_MANAGER') "+nullable+defaultValue;
}
async function migrate(c,apply=false){
 const [tables]=await c.query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()");const names=new Map(tables.map(t=>[String(t.TABLE_NAME).toLowerCase(),t]));
 for(const name of ['users','bets','affiliates','affiliatecommissions','affiliatewallets','transactions','tips','siteflags','cashierdepositwagers'])if(!names.has(name)||String(names.get(name).ENGINE).toLowerCase()!=='innodb')throw Error('Manager feature requires existing InnoDB '+name+'.');
 const [cols]=await c.query('SHOW COLUMNS FROM users');for(const field of ['id','role','perms','balance','banned','accountLock','sponsorLock'])if(!cols.some(x=>x.Field===field))throw Error('Missing users.'+field);
 const ddl=roleMigration(cols.find(x=>x.Field==='role'));const plan=[];if(ddl)plan.push(ddl);
 for(let i=0;i<statements.length;i++){const name=Object.keys(required)[i],table=names.get(name.toLowerCase());if(!table){plan.push(statements[i]);continue;}if(String(table.ENGINE).toLowerCase()!=='innodb')throw Error(name+' must use InnoDB.');const [saved]=await c.query('SHOW COLUMNS FROM '+name);for(const field of required[name])if(!saved.some(x=>x.Field===field))throw Error('Existing manager schema needs review: '+name+'.'+field);const primary=saved.filter(x=>x.Key==='PRI').map(x=>x.Field);const expected=name==='affiliateManagerRequests'?['actorId','requestId']:[required[name][0]];if(primary.join(',')!==expected.join(','))throw Error('Existing manager primary key needs review: '+name);}
 const [[flag]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_affiliate_manager_version'");if(flag&&flag.value!==VERSION)throw Error('Unknown manager schema version.');
 if(apply){for(const q of plan)await c.query(q);await c.query("INSERT IGNORE INTO siteFlags(name,value) VALUES('gb_affiliate_manager_version',?)",[VERSION]);}
 return {statements:plan,version:VERSION,needsFlag:!flag};
}
async function ensureReady(c){const [[flag]]=await c.query("SELECT value FROM siteFlags WHERE name='gb_affiliate_manager_version'");if(flag?.value!==VERSION)throw Error('Affiliate manager schema is not installed. Run APPLY-LOCAL.ps1 before starting this backend.');}
module.exports={VERSION,statements,migrate,ensureReady,roleMigration};
