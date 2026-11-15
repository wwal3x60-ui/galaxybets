'use strict';
const DDL=`CREATE TABLE IF NOT EXISTS accountProfiles (
 userId BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 firstName VARCHAR(100) NULL,lastName VARCHAR(100) NULL,birthday DATE NULL,
 address VARCHAR(255) NULL,addressAlt VARCHAR(255) NULL,city VARCHAR(100) NULL,
 state VARCHAR(100) NULL,country VARCHAR(100) NULL,phone VARCHAR(40) NULL,
 updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
async function migrate(c,apply=false){
 const [tables]=await c.query("SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('users','accountProfiles')");
 const users=tables.find(t=>t.TABLE_NAME.toLowerCase()==='users');if(!users||users.ENGINE!=='InnoDB')throw Error('Account profiles require existing InnoDB users.');
 const [columns]=await c.query('SHOW COLUMNS FROM users');
 for(const name of ['id','username','email','createdAt','emailVerifiedAt','2fa','banned','accountLock'])if(!columns.some(c=>c.Field===name))throw Error('Account dashboard requires users.'+name);
 const [indexes]=await c.query('SHOW INDEX FROM users');const grouped=new Map();for(const row of indexes)if(!row.Non_unique){const group=grouped.get(row.Key_name)||[];group[row.Seq_in_index-1]=row.Column_name;grouped.set(row.Key_name,group);}
 if(![...grouped.values()].some(cols=>cols.join(',')==='username'))throw Error('Unique usernames are required before enabling profile editing.');
 const existing=tables.find(t=>t.TABLE_NAME.toLowerCase()==='accountprofiles');if(!existing){if(apply)await c.query(DDL);return[DDL];}
 if(existing.ENGINE!=='InnoDB')throw Error('accountProfiles must use InnoDB.');
 const [saved]=await c.query('SHOW COLUMNS FROM accountProfiles');for(const field of ['userId','firstName','lastName','birthday','address','addressAlt','city','state','country','phone','updatedAt'])if(!saved.some(x=>x.Field===field))throw Error('Existing account profile schema needs review: '+field);
 if(saved.find(x=>x.Field==='userId').Key!=='PRI')throw Error('Account profiles require a per-user primary key.');return[];
}
module.exports={DDL,migrate};
