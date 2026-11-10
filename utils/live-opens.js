'use strict';
const slugs=require('./launch-pack-slugs.json');
function avatar(name){const letter=Array.from(String(name||'?'))[0].toUpperCase().replace(/[<>&"']/g,'');const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="24" fill="#392356"/><text x="24" y="32" text-anchor="middle" fill="white" font-family="Arial" font-size="23">${letter}</text></svg>`;return 'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);}
function liveOpenRecord(row){
 const anonymous=Boolean(row.anon);const name=anonymous?'Anonymous':String(row.username||'Player');
 return {id:String(row.id),openedAt:row.openedAt?new Date(row.openedAt).toISOString():'',name:String(row.name||'Item'),price:String(row.valueUSD??'0'),image:String(row.img||''),packId:String(row.caseId||''),packName:String(row.caseName||''),user:{name,avatar:avatar(name),isBot:row.role==='BOT'}};
}
function emitLiveOpens(io,user,caseInfo,results){
 if(!slugs.includes(caseInfo.slug))return;
 const openedAt=new Date().toISOString();
 for(const result of results){if(!result.openingId||!result.item)continue;io.emit('live-open:new',{item:liveOpenRecord({id:result.openingId,openedAt,username:user.username,anon:user.anon,role:user.role,name:result.item.name,img:result.item.img,valueUSD:result.item.price,caseId:caseInfo.id,caseName:caseInfo.name})});}
}
function createLiveOpenReader(sql){
 let hasDate;
 return async function read(limit=16,top=false){
  if(hasDate===undefined){const [columns]=await sql.query('SHOW COLUMNS FROM caseOpenings');hasDate=columns.some(row=>row.Field==='createdAt');}
  const placeholders=slugs.map(()=>'?').join(',');
  const [rows]=await sql.query(`SELECT CAST(co.id AS CHAR) AS id,${hasDate?'co.createdAt':'NULL'} AS openedAt,u.username,u.anon,u.role,ci.name,ci.img,CAST(ci.price AS CHAR) AS valueCents,CAST(c.id AS CHAR) AS caseId,c.name AS caseName FROM caseOpenings co JOIN caseItems ci ON ci.id=co.caseItemId JOIN caseVersions cv ON cv.id=co.caseVersionId JOIN cases c ON c.id=cv.caseId JOIN users u ON u.id=co.userId WHERE c.slug IN (${placeholders}) ORDER BY ${top?'ci.price DESC,':''}co.id DESC LIMIT ?`,[...slugs,limit]);
  return rows.map(row=>liveOpenRecord({...row,valueUSD:(Number(row.valueCents)/100).toFixed(2)}));
 };
}
module.exports={avatar,liveOpenRecord,emitLiveOpens,createLiveOpenReader};
