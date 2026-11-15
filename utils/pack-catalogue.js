'use strict';
const TICKETS=100000;
const categoryOf=slug=>slug.startsWith('pokemon-')?'Pokemon':slug.startsWith('csgo-')?'CSGO':slug.startsWith('irl-')?'IRL':null;
/** Classification only. This module never chooses a result or changes odds. */
function distribution(priceCents,items){
 const price=Number(priceCents);if(!Number.isSafeInteger(price)||price<=0||!items.length)return null;
 const rows=items.map(i=>({from:Number(i.rangeFrom),to:Number(i.rangeTo),value:Number(i.price)})).sort((a,b)=>a.from-b.from);let next=1,weighted=0;
 for(const r of rows){if(!Number.isInteger(r.from)||!Number.isInteger(r.to)||r.from!==next||r.to<r.from||r.to>TICKETS||!Number.isSafeInteger(r.value)||r.value<0)return null;next=r.to+1;weighted+=(r.to-r.from+1)*r.value;}
 if(next!==TICKETS+1||weighted===0)return null;
 const mean=weighted/TICKETS,variance=rows.reduce((sum,r)=>sum+(r.to-r.from+1)/TICKETS*(r.value-mean)**2,0),coefficient=Math.sqrt(variance)/mean;
 return{risk:coefficient<=.75?'Low':'High',coefficient:Number(coefficient.toFixed(6)),rtpPercent:Number((mean/price*100).toFixed(6))};
}
const money=v=>{const n=String(v).trim(),value=Number(n);if(!/^\d+(?:\.\d{1,2})?$/.test(n)||!Number.isFinite(value)||!Number.isSafeInteger(Math.round(value*100)))throw Error('INVALID_PRICE');return value;};
function filters(query){
 const allowed=new Set(['category','search','source','sort','volatility','minPrice','maxPrice','page','limit']);for(const key of Object.keys(query))if(!allowed.has(key))throw Error('INVALID_FILTER');
 const category=query.category||'All',risk=query.volatility||'All',source=query.source||'All',sort=query.sort||'Newest';
 if(!['All','Pokemon','CSGO','IRL'].includes(category)||!['All','Low','High'].includes(risk)||!['All','Official','Community'].includes(source)||!['Newest','Oldest','Price: Low to High','Price: High to Low','Name: A-Z','Name: Z-A'].includes(sort))throw Error('INVALID_FILTER');
 const search=query.search||'';if(typeof search!=='string'||search.length>100)throw Error('INVALID_SEARCH');
 const page=query.page===undefined?1:Number(query.page),limit=query.limit===undefined?24:Number(query.limit);if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isInteger(limit)||limit<1||limit>100)throw Error('INVALID_PAGINATION');
 const min=query.minPrice===undefined?null:money(query.minPrice),max=query.maxPrice===undefined?null:money(query.maxPrice);if(min!==null&&max!==null&&min>max)throw Error('INVALID_PRICE');return{category,risk,source,sort,search:search.trim().toLowerCase(),page,limit,min,max};
}
function createCatalogue({sql,now=()=>Date.now()}){
 let snapshot=null,pending=null;
 async function load(){
  if(snapshot&&now()-snapshot.at<30000)return snapshot.rows;
  if(pending)return pending;
  pending=(async()=>{
   const [packs]=await sql.query('SELECT CAST(c.id AS CHAR) AS id,c.name,c.slug,c.img,CAST(cv.price AS CHAR) AS priceCents,CAST(cv.id AS CHAR) AS versionId,cv.createdAt AS modifiedAt FROM cases c JOIN caseVersions cv ON cv.caseId=c.id AND cv.endedAt IS NULL');
   const versions=packs.map(p=>p.versionId),[items]=versions.length?await sql.query('SELECT CAST(caseVersionId AS CHAR) AS versionId,CAST(price AS CHAR) AS price,rangeFrom,rangeTo FROM caseItems WHERE caseVersionId IN (?)',[versions]):[[]];
   const byVersion=new Map();for(const i of items){const group=byVersion.get(String(i.versionId))||[];group.push(i);byVersion.set(String(i.versionId),group);}
   const seen=new Set();const rows=packs.map(p=>{if(seen.has(p.id))throw Error('MULTIPLE_ACTIVE_PACK_VERSIONS');seen.add(p.id);const drops=byVersion.get(p.versionId)||[],metrics=distribution(p.priceCents,drops),category=categoryOf(p.slug);return{id:p.id,name:p.name,slug:p.slug,img:p.img,price:(Number(p.priceCents)/100).toFixed(2),itemCount:drops.length,category,isOfficial:!!category,risk:metrics?.risk||null,rtpPercent:metrics?.rtpPercent??null,modifiedAt:p.modifiedAt};});
   snapshot={at:now(),rows};return rows;
  })();try{return await pending;}finally{pending=null;}
 }
 async function list(query={}){
  const f=filters(query);let rows=(await load()).filter(p=>(f.category==='All'||p.category===f.category)&&(f.risk==='All'||p.risk===f.risk)&&(f.source==='All'||f.source==='Official'&&p.isOfficial)&&(f.min===null||Number(p.price)>=f.min)&&(f.max===null||Number(p.price)<=f.max)&&p.name.toLowerCase().includes(f.search));
  rows=rows.slice().sort((a,b)=>f.sort==='Price: Low to High'?Number(a.price)-Number(b.price):f.sort==='Price: High to Low'?Number(b.price)-Number(a.price):f.sort==='Name: A-Z'?a.name.localeCompare(b.name):f.sort==='Name: Z-A'?b.name.localeCompare(a.name):f.sort==='Oldest'?new Date(a.modifiedAt)-new Date(b.modifiedAt):new Date(b.modifiedAt)-new Date(a.modifiedAt));
  const offset=(f.page-1)*f.limit;return{version:'pack-risk-v1',packs:rows.slice(offset,offset+f.limit),total:rows.length,hasMore:offset+f.limit<rows.length,limit:f.limit,offset};
 }
 return{list};
}
module.exports={TICKETS,categoryOf,distribution,filters,createCatalogue};
