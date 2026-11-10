'use strict';
const crypto=require('crypto');
const catalog=require('./budget40-catalog.json');
const prefix={Pokemon:'pokemon',CSGO:'csgo',IRL:'irl'};
function validate(value=catalog){
 const counts={Pokemon:0,CSGO:0,IRL:0},slugs=new Set(),ids=new Set();
 if(value.revision!=='budget40-v1'||value.ticketCount!==100000||value.packs?.length!==40)throw Error('Invalid budget catalog revision/count');
 for(const pack of value.packs){
  if(!Object.hasOwn(counts,pack.category))throw Error('Invalid category');counts[pack.category]++;
  if(!pack.name||!pack.slug.startsWith(prefix[pack.category]+'-budget-')||!/^[a-z0-9-]+$/.test(pack.slug)||slugs.has(pack.slug))throw Error('Invalid/duplicate budget slug');slugs.add(pack.slug);
  if(!Number.isSafeInteger(pack.priceCents)||pack.priceCents<15||pack.priceCents>1500)throw Error('Budget price must be $0.15–$15');
  if(pack.items?.length!==10)throw Error('Ten rewards required');
  let next=1,total=0n;
  for(const item of pack.items){
   if(!item.name||!/^74\d{11}$/.test(item.catalogId)||ids.has(item.catalogId))throw Error('Invalid/duplicate budget reward ID');ids.add(item.catalogId);
   if(!Number.isSafeInteger(item.valueCents)||item.valueCents<1||!Number.isSafeInteger(item.tickets)||item.tickets<1||item.rangeFrom!==next||item.rangeTo!==next+item.tickets-1)throw Error('Invalid value/ticket coverage');
   if(item.assetKey==='gb-budget-site-credit'&&!item.name.endsWith('Site Balance Voucher (sell to redeem)'))throw Error('Voucher must be clearly labelled');
   next=item.rangeTo+1;total+=BigInt(item.valueCents)*BigInt(item.tickets);
  }
  if(next!==100001||total!==BigInt(pack.priceCents)*90000n)throw Error('Expected return must be exactly 90%');
 }
 if(counts.Pokemon!==10||counts.CSGO!==10||counts.IRL!==20)throw Error('Wrong category totals');return counts;
}
async function plan(c,lock=false){
 const result=[];
 for(const pack of catalog.packs){
  const [rows]=await c.query('SELECT CAST(id AS CHAR) AS id,name,img FROM cases WHERE slug=?'+(lock?' FOR UPDATE':''),[pack.slug]);
  if(rows.length>1)throw Error('Duplicate slug: '+pack.slug);const row=rows[0];
  if(!row){result.push({pack,action:'insert'});continue;}
  const [versions]=await c.query('SELECT CAST(id AS CHAR) AS id,CAST(price AS CHAR) AS price FROM caseVersions WHERE caseId=? AND endedAt IS NULL'+(lock?' FOR UPDATE':''),[row.id]);
  if(row.name!==pack.name||row.img!==pack.image||versions.length!==1||String(versions[0].price)!==String(pack.priceCents))throw Error('Existing budget pack differs; refusing to overwrite: '+pack.slug);
  const [items]=await c.query('SELECT name,img,CAST(price AS CHAR) AS price,CAST(robloxId AS CHAR) AS catalogId,rangeFrom,rangeTo FROM caseItems WHERE caseVersionId=? ORDER BY rangeFrom'+(lock?' FOR UPDATE':''),[versions[0].id]);
  if(items.length!==pack.items.length||items.some((v,i)=>v.name!==pack.items[i].name||v.img!==pack.items[i].image||String(v.price)!==String(pack.items[i].valueCents)||String(v.catalogId)!==pack.items[i].catalogId||Number(v.rangeFrom)!==pack.items[i].rangeFrom||Number(v.rangeTo)!==pack.items[i].rangeTo))throw Error('Existing budget rewards differ; refusing to overwrite: '+pack.slug);
  result.push({pack,action:'unchanged',caseId:row.id});
 }
 return result;
}
async function preserveSnapshot(c){
 // Snapshot all catalog rows outside this new collection, including retired historical versions.
 const slugs=catalog.packs.map(p=>p.slug);
 const [cases]=await c.query('SELECT * FROM cases WHERE slug NOT IN (?) ORDER BY id',[slugs]);
 const [versions]=await c.query('SELECT cv.* FROM caseVersions cv JOIN cases c ON c.id=cv.caseId WHERE c.slug NOT IN (?) ORDER BY cv.id',[slugs]);
 const [items]=await c.query('SELECT ci.* FROM caseItems ci JOIN caseVersions cv ON cv.id=ci.caseVersionId JOIN cases c ON c.id=cv.caseId WHERE c.slug NOT IN (?) ORDER BY ci.id',[slugs]);
 return {cases:cases.length,versions:versions.length,items:items.length,hash:crypto.createHash('sha256').update(JSON.stringify([cases,versions,items])).digest('hex')};
}
async function apply(c){
 const entries=await plan(c,true);const before=await preserveSnapshot(c);let inserted=0,unchanged=0;
 for(const {pack,action}of entries){
  if(action==='unchanged'){unchanged++;continue;}
  const [newCase]=await c.query('INSERT INTO cases (name,slug,img) VALUES (?,?,?)',[pack.name,pack.slug,pack.image]);
  const [newVersion]=await c.query('INSERT INTO caseVersions (caseId,price) VALUES (?,?)',[newCase.insertId,pack.priceCents]);
  for(const i of pack.items)await c.query('INSERT INTO caseItems (caseVersionId,robloxId,name,img,price,robloxPrice,rangeFrom,rangeTo) VALUES (?,?,?,?,?,0,?,?)',[newVersion.insertId,i.catalogId,i.name,i.image,i.valueCents,i.rangeFrom,i.rangeTo]);
  inserted++;
 }
 const after=await preserveSnapshot(c);if(before.hash!==after.hash)throw Error('An existing catalog row changed. Rolling back.');
 const final=await plan(c,true);if(final.some(x=>x.action!=='unchanged'))throw Error('Final verification failed');
 return {inserted,unchanged,protectedCatalog:before};
}
module.exports={catalog,validate,plan,apply,preserveSnapshot};
