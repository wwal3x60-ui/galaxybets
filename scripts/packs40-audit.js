'use strict';
const path=require('path');
require('dotenv').config({path:path.join(__dirname,'../.env')});
const {sql}=require('../database');
const catalog=require('../utils/galaxy-packs40.json');
async function main(){
 const result={missingPacks:0,invalidVersions:0,invalidPrices:0,invalidRewards:0,invalidTicketRanges:0,invalidExpectedReturn:0};
 let found=0;
 for(const pack of catalog.packs){
  const [[row]]=await sql.query('SELECT CAST(id AS CHAR) AS id, name, img FROM cases WHERE slug = ?',[pack.slug]);
  if(!row){result.missingPacks++;continue;}found++;
  if(row.name!==pack.name||row.img!==pack.image)result.invalidRewards++;
  const [versions]=await sql.query('SELECT CAST(id AS CHAR) AS id, CAST(price AS CHAR) AS price FROM caseVersions WHERE caseId = ? AND endedAt IS NULL',[row.id]);
  if(versions.length!==1){result.invalidVersions++;continue;}
  if(String(versions[0].price)!==String(pack.priceCents))result.invalidPrices++;
  const [items]=await sql.query('SELECT name, img, CAST(price AS CHAR) AS price, rangeFrom, rangeTo FROM caseItems WHERE caseVersionId = ? ORDER BY rangeFrom',[versions[0].id]);
  let next=1,total=0n,rangeError=false;
  for(const item of items){const start=Number(item.rangeFrom),end=Number(item.rangeTo);if(start!==next||end<start)rangeError=true;next=end+1;total+=BigInt(item.price)*BigInt(end-start+1);}
  if(next!==100001||rangeError)result.invalidTicketRanges++;
  if(total!==BigInt(pack.priceCents)*90000n)result.invalidExpectedReturn++;
  if(items.length!==pack.items.length||items.some((item,i)=>!pack.items[i]||item.name!==pack.items[i].name||item.img!==pack.items[i].image||String(item.price)!==String(pack.items[i].valueCents)||Number(item.rangeFrom)!==pack.items[i].rangeFrom||Number(item.rangeTo)!==pack.items[i].rangeTo))result.invalidRewards++;
 }
 console.table(result);console.log({catalogPacks:40,installedPacks:found,targetReturn:'90%',houseEdge:'10%'});
 if(Object.values(result).some(Boolean))process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>sql.end());
