'use strict';
const DDL=`CREATE TABLE IF NOT EXISTS wagerMilestoneClaims (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
 userId BIGINT UNSIGNED NOT NULL,
 milestoneCode VARCHAR(32) NOT NULL,
 thresholdAmount DECIMAL(18,2) NOT NULL,
 rewardAmount DECIMAL(18,2) NOT NULL,
 wageredAtClaim DECIMAL(30,2) NOT NULL,
 transactionId BIGINT UNSIGNED NULL,
 createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY(id), UNIQUE KEY uq_wager_milestone_user(userId,milestoneCode),
 UNIQUE KEY uq_wager_milestone_transaction(transactionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
async function migrate(c,apply=false){
 const [engines]=await c.query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('users','bets','transactions','wagerMilestoneClaims')");
 for(const name of ['users','bets','transactions']){const table=engines.find(t=>t.TABLE_NAME.toLowerCase()===name.toLowerCase());if(!table||table.ENGINE!=='InnoDB')throw Error('Wager rewards require existing InnoDB '+name);}
 for(const [table,required]of Object.entries({users:['id','balance','role','banned','accountLock','sponsorLock'],bets:['userId','amount','completed','game'],transactions:['id','userId','amount','type','method','methodId']})){
  const [columns]=await c.query('SHOW COLUMNS FROM `'+table+'`');for(const name of required)if(!columns.some(x=>x.Field===name))throw Error('Wager rewards require '+table+'.'+name);
  const money=columns.find(x=>x.Field===(table==='users'?'balance':'amount'));if(!/^decimal\(\d+,2\)/i.test(money.Type))throw Error('Wager rewards require exact two-decimal money in '+table);
  if(table==='transactions')for(const [name,value]of [['type','in'],['method','promo']]){const type=columns.find(x=>x.Field===name).Type;if(/^enum\(/i.test(type)&&!type.includes("'"+value+"'"))throw Error('Existing transaction schema does not support '+name+'='+value);}
 }
 const existing=engines.find(t=>t.TABLE_NAME.toLowerCase()==='wagermilestoneclaims');
 if(!existing){if(apply)await c.query(DDL);return[DDL];}
 if(existing.ENGINE!=='InnoDB')throw Error('Wager milestone claims must use InnoDB.');
 const [columns]=await c.query('SHOW COLUMNS FROM wagerMilestoneClaims');for(const name of ['id','userId','milestoneCode','thresholdAmount','rewardAmount','wageredAtClaim','transactionId','createdAt'])if(!columns.some(x=>x.Field===name))throw Error('Existing wager reward audit schema needs review.');
 const [indexes]=await c.query('SHOW INDEX FROM wagerMilestoneClaims');const groups=new Map();for(const row of indexes)if(!row.Non_unique){const cols=groups.get(row.Key_name)||[];cols[row.Seq_in_index-1]=row.Column_name;groups.set(row.Key_name,cols);}if(![...groups.values()].some(cols=>cols.join(',')==='userId,milestoneCode'))throw Error('One-time reward uniqueness is missing.');return[];
}
module.exports={DDL,migrate};
