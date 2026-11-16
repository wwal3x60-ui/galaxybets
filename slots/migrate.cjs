'use strict';
// Invoked from the backend folder. Never runs as a side effect of app startup.
const fs=require('node:fs'),path=require('node:path');
require('dotenv').config({quiet:true});
const {sql}=require('../database');
(async()=>{try{
 const [[db]]=await sql.query('SELECT DATABASE() AS name');
 if(!db?.name)throw Error('No database selected');
 const [columns]=await sql.query("SELECT COLUMN_NAME,COLUMN_TYPE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='users'");
 const names=new Set(columns.map(c=>c.COLUMN_NAME));
 for(const name of ['id','balance','role','banned','accountLock','sponsorLock'])if(!names.has(name))throw Error('Missing users.'+name);
 const balance=columns.find(c=>c.COLUMN_NAME==='balance');
 if(!/^decimal\(\d+,2\)/i.test(balance.COLUMN_TYPE))throw Error('Review required: users.balance must be DECIMAL with two decimal places');
 if(process.argv.includes('--check')){console.log('Database compatibility passed. No changes made.');return;}
 const statements=fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8').split(';').map(s=>s.trim()).filter(Boolean);
 for(const statement of statements)await sql.query(statement);
 console.log('Slots tables installed. Existing user balances and game tables were not changed.');
 }catch(e){console.error('Slots schema stopped:',e.code||e.message);process.exitCode=1;}finally{await sql.end();}})();
