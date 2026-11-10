'use strict';
const fs=require('fs'),path=require('path'),{catalog,validate,plan,apply}=require('../utils/budget40-service');
const root=path.resolve(__dirname,'..');
function assets(){for(const p of catalog.packs)for(const url of [p.image,...p.items.map(i=>i.image)]){if(!/^\/public\/(packs|drop-images)\/[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp|avif)$/.test(url))throw Error('Unexpected asset path');const f=path.join(root,url.slice(1));if(!fs.existsSync(f)||fs.statSync(f).size<50)throw Error('Missing catalog image: '+url);}}
async function main(){
 const args=process.argv.slice(2),mutate=args.includes('--apply'),audit=args.includes('--audit'),get=k=>{const n=args.indexOf(k);return n<0?null:args[n+1]};validate();assets();
 if(!process.env.GB_BUDGET_AIVEN_PASSWORD)throw Error('Use the PowerShell runner to provide credentials.');
 if(mutate){if(!args.includes('--backend-stopped'))throw Error('Stop the Render backend and all other database writers before applying.');const backup=get('--backup');if(!backup||!fs.existsSync(backup)||fs.statSync(backup).size<1000||Date.now()-fs.statSync(backup).mtimeMs>30*60*1000)throw Error('A fresh remote database backup is required.');}
 const ca=get('--ca');if(!ca)throw Error('CA certificate required');
 const c=await require('mysql2/promise').createConnection({host:'mysql-3dd690bd-galaxybets.h.aivencloud.com',port:11840,user:'avnadmin',database:'defaultdb',password:process.env.GB_BUDGET_AIVEN_PASSWORD,ssl:{ca:fs.readFileSync(ca,'utf8'),rejectUnauthorized:true},supportBigNumbers:true,bigNumberStrings:true,connectTimeout:20000});
 let locked=false;
 try{
  const [[target]]=await c.query('SELECT DATABASE() AS db');if(target.db!=='defaultdb')throw Error('Unexpected database');
  for(const table of ['cases','caseVersions','caseItems']){const [[engine]]=await c.query('SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?',[table]);if(engine?.engine!=='InnoDB')throw Error('Transactional InnoDB table required: '+table);}
  for(const table of ['caseVersions','caseItems']){const [columns]=await c.query('SHOW COLUMNS FROM '+table);if(!columns.some(x=>x.Field==='price'&&/^bigint/i.test(x.Type)))throw Error('Price column must use integer cents: '+table);}
  if(mutate){const [[r]]=await c.query("SELECT GET_LOCK('galaxybets-budget40-v1',10) AS acquired");if(Number(r.acquired)!==1)throw Error('Another budget migration is running');locked=true;}
  const entries=await plan(c);
  console.table(entries.map(({pack:p,action})=>({pack:p.name,category:p.category,price:p.openingPriceUSD,return:'90.000%',voucherChance:(p.items[0].tickets/1000).toFixed(3)+'%',topDrop:p.items.at(-1).valueUSD,topChance:(p.items.at(-1).tickets/1000).toFixed(3)+'%',action})));
  console.log({mode:mutate?'apply':audit?'audit':'READ-ONLY PREVIEW',newPacks:entries.filter(x=>x.action==='insert').length,existingBudgetPacks:entries.filter(x=>x.action==='unchanged').length,categories:catalog.counts,physicalDelivery:false});
  if(audit&&entries.some(x=>x.action!=='unchanged'))throw Error('Budget collection not fully installed.');
  if(!mutate){console.log('No database changes. Existing packs remain unchanged.');return;}
  await c.beginTransaction();try{const value=await apply(c);await c.commit();console.log('Budget collection installed:',value);console.log('40 additional packs verified. Restart the backend to refresh its catalog.');}catch(e){await c.rollback();throw e;}
 }finally{if(locked)await c.query("SELECT RELEASE_LOCK('galaxybets-budget40-v1')").catch(()=>{});await c.end();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});module.exports={assets};
