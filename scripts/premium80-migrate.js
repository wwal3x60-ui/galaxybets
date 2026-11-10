'use strict';
const path=require('path');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const {sql,doTransaction}=require('../database');
const catalog=require('../utils/premium80-catalog.json');
const baseline=require('../utils/premium80-baseline.json');
const {validatePremium80}=require('../utils/premium80-validator');
const {planPremium80,applyPremium80}=require('../utils/premium80-migration');
const {validateCutouts}=require('../utils/drop-cutouts-validator');
async function main(){
 const root=path.join(__dirname,'..');validatePremium80(catalog,root);const cutouts=validateCutouts(root);
 const apply=process.argv.includes('--apply');
 if(apply&&!process.argv.includes('--backend-stopped'))throw Error('Stop the backend and add --backend-stopped before applying.');
 const plan=await planPremium80(sql,catalog,baseline);
 console.table(plan.filter(e=>e.pack.priceCents>30000).map(e=>({pack:e.pack.name,price:(e.pack.priceCents/100).toFixed(2),belowPrice:'80.000%',abovePrice:'20.000%',breakEven:'0%',topDrop:'15000.00',topChance:'0.100%',action:e.action})));
 console.log({mode:apply?'apply':'preview',unchangedLowerPricedPacks:37,cleanedImages:cutouts,targetReturn:'90%'});
 if(!apply){console.log('Read-only preview. Only three packs above $300 will receive new reward versions.');return;}
 const result=await doTransaction(async(connection,commit)=>{const result=await applyPremium80(connection,catalog,baseline);await commit();return result;});
 console.log('Premium 80/20 balance installed:',result);
 console.log('Old inventory, history and all lower-priced pack odds were preserved. Restart backend and frontend.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>sql.end());
