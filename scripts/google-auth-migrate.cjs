'use strict';
const fs=require('node:fs');const path=require('node:path');
require('dotenv').config({path:path.join(__dirname,'..','.env')});
const {sql}=require('../database');
(async()=>{
 try {
  const source=fs.readFileSync(path.join(__dirname,'..','db','migrations','google-auth-v1.sql'),'utf8');
  for(const statement of source.split(';').map(s=>s.trim()).filter(Boolean))await sql.query(statement);
  // Read index metadata instead of parsing SQL identifier quoting.
  await sql.query('SELECT googleSubject, userId, createdAt FROM googleIdentities LIMIT 0');
  const [indexes]=await sql.query('SHOW INDEX FROM googleIdentities');
  const groups=new Map();
  for(const row of indexes){
   if(!groups.has(row.Key_name))groups.set(row.Key_name,[]);
   groups.get(row.Key_name).push(row);
  }
  const exactUnique=(name,column)=>{
   const rows=groups.get(name)||[];
   return rows.length===1 && Number(rows[0].Non_unique)===0 &&
    rows[0].Column_name===column && Number(rows[0].Seq_in_index)===1 && rows[0].Sub_part==null;
  };
  if(!exactUnique('PRIMARY','googleSubject') ||
   ![...groups.keys()].some(name=>exactUnique(name,'userId')))
   throw new Error('Google identity table has an incompatible definition');
  await sql.query('SELECT nonce, expiresAt FROM googleAuthChallenges LIMIT 0');
  console.log('Google authentication tables ready. Existing wallet data was not modified.');
 } catch(error){console.error('Google migration failed:',error.code||error.message);process.exitCode=1;}
 finally{await sql.end();}
})();
