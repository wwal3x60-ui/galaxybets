'use strict';
const fields=Object.freeze({firstName:100,lastName:100,address:255,addressAlt:255,city:100,state:100,country:100,phone:40});
const reserved=new Set(['admin','administrator','support','mod','moderator','staff','galaxybets','system','owner','root','null','undefined','bot']);
function fail(code,status=400){throw Object.assign(new Error(code),{publicError:code,status});}
function validate(body,now=new Date()){
 if(!body||typeof body!=='object'||Array.isArray(body)||!Object.keys(body).length)fail('INVALID_PROFILE');
 const result={};for(const [key,value]of Object.entries(body)){
  if(key==='username'){if(typeof value!=='string'||!/^[A-Za-z0-9_]{3,20}$/.test(value.trim())||reserved.has(value.trim().toLowerCase()))fail('INVALID_USERNAME');result.username=value.trim();}
  else if(key==='birthday'){
   if(value===null||value===''){result.birthday=null;continue;}
   if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('INVALID_BIRTHDAY');const d=new Date(value+'T00:00:00Z');
   if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value||value>now.toISOString().slice(0,10)||value<'1900-01-01')fail('INVALID_BIRTHDAY');result.birthday=value;
  }else if(Object.hasOwn(fields,key)){
   if(value!==null&&typeof value!=='string')fail('INVALID_PROFILE_FIELD');const clean=value===null?'':value.trim();if(clean.length>fields[key]||/[\u0000-\u001f\u007f]/.test(clean))fail('INVALID_PROFILE_FIELD');result[key]=clean||null;
  }else fail('INVALID_PROFILE_FIELD');
 }return result;
}
function createProfileService({sql,transaction}){
 async function get(userId,c=sql){
  const [[row]]=await c.query(`SELECT CAST(u.id AS CHAR) AS id,u.username,u.email,u.role,u.createdAt,
   (u.emailVerifiedAt IS NOT NULL) AS emailVerified,(u.\`2fa\` IS NOT NULL AND u.\`2fa\`<>'') AS twoFactorConfigured,
   p.firstName,p.lastName,DATE_FORMAT(p.birthday,'%Y-%m-%d') AS birthday,p.address,p.addressAlt,p.city,p.state,p.country,p.phone
   FROM users u LEFT JOIN accountProfiles p ON p.userId=u.id WHERE u.id=?`,[userId]);
  if(!row)fail('UNAUTHORIZED',401);return{...row,id:String(row.id),emailVerified:!!row.emailVerified,twoFactorConfigured:!!row.twoFactorConfigured};
 }
 async function update(userId,body){
  const patch=validate(body);
  try{return await transaction(async(c,commit)=>{
   const [[user]]=await c.query('SELECT id,banned,accountLock FROM users WHERE id=? FOR UPDATE',[userId]);if(!user)fail('UNAUTHORIZED',401);if(user.banned||user.accountLock)fail('ACCOUNT_RESTRICTED',403);
   if(Object.hasOwn(patch,'username'))await c.query('UPDATE users SET username=? WHERE id=?',[patch.username,userId]);
   const keys=Object.keys(patch).filter(k=>k!=='username');if(keys.length)await c.query('INSERT INTO accountProfiles(userId,'+keys.map(k=>'`'+k+'`').join(',')+') VALUES ('+Array(keys.length+1).fill('?').join(',')+') ON DUPLICATE KEY UPDATE '+keys.map(k=>'`'+k+'`=VALUES(`'+k+'`)').join(','),[userId,...keys.map(k=>patch[k])]);
   const profile=await get(userId,c);await commit();return profile;
  });}catch(e){if(e.code==='ER_DUP_ENTRY')fail('USERNAME_TAKEN',409);throw e;}
 }
 return{get,update};
}
module.exports={fields,validate,createProfileService};
