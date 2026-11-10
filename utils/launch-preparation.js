'use strict';
const catalog=require('./launch-pack-catalog.json');
const {planPremium80}=require('./launch-pack-guard');
async function inspect(connection,lock=false){
 const packs=await planPremium80(connection,catalog,catalog,lock);
 if(packs.some(p=>p.action!=='unchanged'))throw Error('The 40 pack guard did not match');
 const minId=packs.reduce((min,p)=>BigInt(p.caseId)<min?BigInt(p.caseId):min,BigInt(packs[0].caseId)).toString();
 const keep=catalog.packs.map(p=>p.slug),marks=keep.map(()=>'?').join(',');
 const [legacy]=await connection.query(`SELECT CAST(c.id AS CHAR) AS id,c.name,c.slug,CAST(cv.id AS CHAR) AS versionId,CAST(cv.price AS CHAR) AS price FROM cases c JOIN caseVersions cv ON cv.caseId=c.id AND cv.endedAt IS NULL WHERE c.id < ? AND c.slug NOT IN (${marks}) ORDER BY c.id`+(lock?' FOR UPDATE':''),[minId,...keep]);
 const [noope]=await connection.query('SELECT CAST(id AS CHAR) AS id,username,role,leaderboardBan FROM users WHERE LOWER(username) = ?'+(lock?' FOR UPDATE':''),['noope']);
 if(noope.length!==1)throw Error('Expected one exact NOOPE account; no changes were applied');
 return {packs,legacy,noope:noope[0],boundary:minId};
}
async function apply(connection){
 const before=await inspect(connection,true);
 const fingerprint=JSON.stringify(before.packs.map(p=>({caseId:p.caseId,versionId:p.versionId,pack:p.pack})));
 for(const legacy of before.legacy)await connection.query('UPDATE caseVersions SET endedAt = NOW() WHERE id = ? AND endedAt IS NULL',[legacy.versionId]);
 await connection.query('UPDATE users SET leaderboardBan = 1 WHERE id = ?',[before.noope.id]);
 const after=await inspect(connection,true);
 if(JSON.stringify(after.packs.map(p=>({caseId:p.caseId,versionId:p.versionId,pack:p.pack})))!==fingerprint)throw Error('Pack guard changed; rolling back');
 if(after.legacy.length||Number(after.noope.leaderboardBan)!==1)throw Error('Launch preparation verification failed');
 return {legacyCasesRetired:before.legacy.length,protectedPacks:40,noopeExcluded:true};
}
module.exports={inspect,apply};
