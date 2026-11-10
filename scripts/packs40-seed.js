'use strict';
const fs=require('fs'),path=require('path');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const {sql,doTransaction}=require('../database');
const catalog=require('../utils/galaxy-packs40.json');
const {validateCatalog}=require('../utils/pack-catalog-validator');
const {seedCatalog}=require('../utils/pack-catalog-seeder');
const dollars=cents=>(cents/100).toFixed(2);
function assets(){
    for(const pack of catalog.packs){
        for(const url of [pack.image,...pack.items.map(item=>item.image)]){
            if(!/^\/public\/(packs|pack-rewards)\/[a-z0-9.-]+$/.test(url))throw Error('Invalid local asset path');
            const file=path.join(__dirname,'..',url.slice(1));
            if(!fs.existsSync(file)||!fs.statSync(file).size)throw Error('Missing asset: '+url);
        }
    }
}
async function main(){
    const counts=validateCatalog(catalog);assets();
    for(const table of ['caseVersions','caseItems']){
        const [columns]=await sql.query('SHOW COLUMNS FROM `'+table+'`');
        if(!columns.find(column=>column.Field==='price'&&/^bigint/i.test(column.Type)))throw Error(table+'.price must already use integer cents; no schema conversion was attempted.');
    }
    console.table(catalog.packs.map(pack=>({pack:pack.name,category:pack.category,price:dollars(pack.priceCents),averageReturn:dollars(pack.expectedReturnCents),rewards:pack.items.length})));
    console.log({mode:process.argv.includes('--apply')?'apply':'preview',counts,houseEdge:'10%',ticketCoverage:'1–100000'});
    if(!process.argv.includes('--apply')){console.log('Read-only preview. Review the reward values and contents before --apply.');return;}
    const result=await doTransaction(async(connection,commit)=>{
        const result=await seedCatalog(connection,catalog);
        await commit();return result;
    });
    console.log('Pack catalog applied:',result);console.log('Restart the backend to refresh its pack cache. Existing packs, balances and history were preserved.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>sql.end());
