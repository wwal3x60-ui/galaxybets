'use strict';
const fs=require('node:fs'),path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'..','.env')});
const {sql}=require('../database');
(async()=>{try{
 const ddl=fs.readFileSync(path.join(__dirname,'../db/migrations/password-reset-v1.sql'),'utf8');
 for(const statement of ddl.split(';').map(x=>x.trim()).filter(Boolean))await sql.query(statement);
 await sql.query('SELECT userId,tokenHash,emailSnapshot,passwordSnapshot,requestedAt,expiresAt,revokedBeforeMs FROM passwordResetTokens LIMIT 0');
 const [indexes]=await sql.query('SHOW INDEX FROM passwordResetTokens');
 for(const [name,column] of [['PRIMARY','userId'],['uq_passwordResetTokens_hash','tokenHash']]){
  const rows=indexes.filter(x=>x.Key_name===name);
  if(rows.length!==1 || rows[0].Column_name!==column || Number(rows[0].Non_unique)!==0 || rows[0].Sub_part!=null)throw new Error('Password reset table has incompatible indexes');
 }
 console.log('Password reset table ready. Existing passwords and wallets were not changed.');
}catch(error){console.error('Password reset migration failed:',error.code||error.message);process.exitCode=1;}finally{await sql.end();}})();
