'use strict';
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const TTL = 20 * 60 * 1000;
const MESSAGE = 'If this email belongs to an eligible email/password account, a reset link will arrive shortly. Check your spam folder too.';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const fields = 'u.id, u.email, u.username, u.passwordHash, u.role, u.banned, u.accountLock, u.sponsorLock, u.`2fa`, (SELECT g.userId FROM googleIdentities g WHERE g.userId=u.id LIMIT 1) AS googleUserId';
class ResetError extends Error { constructor(code,status=400){super(code);this.code=code;this.status=status;} }
function eligible(user,bans){
 return !!user && !user.banned && !user.accountLock && !user.sponsorLock && !user['2fa'] &&
  !user.googleUserId && !bans.has(String(user.id)) && ['USER','STREAMER','AFFILIATE_MANAGER','MOD','DEV','ADMIN','OWNER'].includes(String(user.role).toUpperCase());
}
function isResetRevoked(payload, revokedBeforeMs) {
 const cutoff = Number(revokedBeforeMs || 0);
 if (!cutoff) return false;
 const issued = Number(payload.authTime || Number(payload.iat)*1000);
 return !Number.isFinite(issued) || issued <= cutoff;
}
function validPassword(password,user,commonPasswords){
 if(typeof password!=='string')return false;
 const size=Buffer.byteLength(password,'utf8'),lower=password.toLowerCase();
 return size>=10 && size<=72 && !commonPasswords.has(lower) && lower!==String(user.username).toLowerCase() && lower!==String(user.email).toLowerCase();
}
function createPasswordResetService(deps) {
 const {sql,doTransaction,sendEmail,bannedUsers=new Set(),lastLogouts={},commonPasswords=new Set(),revokeSockets=()=>{}}=deps;
 const now=deps.now || Date.now;
 const hashPassword=deps.hashPassword || (password=>bcrypt.hash(password,12));
 const siteUrl=deps.siteUrl;
 async function request(email){
  const token=crypto.randomBytes(32).toString('hex'), tokenHash=digest(token);
  const mail=await doTransaction(async(connection,commit)=>{
   const [[user]]=await connection.query(`SELECT ${fields} FROM users u WHERE u.email=? FOR UPDATE`,[email]);
   if(!eligible(user,bannedUsers))return null;
   const [[previous]]=await connection.query('SELECT requestedAt FROM passwordResetTokens WHERE userId=? FOR UPDATE',[user.id]);
   if(previous && now()-new Date(previous.requestedAt).getTime()<60000)return null;
   await connection.query(`INSERT INTO passwordResetTokens (userId,tokenHash,emailSnapshot,passwordSnapshot,requestedAt,expiresAt,revokedBeforeMs)
    VALUES (?,?,?,?,?,?,0) ON DUPLICATE KEY UPDATE tokenHash=VALUES(tokenHash),emailSnapshot=VALUES(emailSnapshot),passwordSnapshot=VALUES(passwordSnapshot),requestedAt=VALUES(requestedAt),expiresAt=VALUES(expiresAt)`,
    [user.id,tokenHash,user.email,user.passwordHash,new Date(now()),new Date(now()+TTL)]);
   await commit();
   return {to:user.email};
  });
  if(!mail)return;
  const url=new URL('/reset-password',siteUrl);url.hash='token='+token;
  try {
   await sendEmail({to:mail.to,subject:'Reset your GalaxyBets password',text:`A password reset was requested for your GalaxyBets account.\n\nChoose a new password using this link:\n${url.href}\n\nThis link expires in 20 minutes and works once. If you did not request this, ignore this email. Your password has not changed.\n\nGalaxyBets`});
  } catch(error){
   await sql.query('UPDATE passwordResetTokens SET tokenHash=NULL,expiresAt=NULL WHERE tokenHash=?',[tokenHash]);
   throw error;
  }
 }
 async function complete(token,password){
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new ResetError('RESET_INVALID');
  if(typeof password!=='string'||Buffer.byteLength(password,'utf8')<10||Buffer.byteLength(password,'utf8')>72)throw new ResetError('INVALID_PASSWORD');
  const tokenHash=digest(token);
  const [[lookup]]=await sql.query('SELECT userId FROM passwordResetTokens WHERE tokenHash=?',[tokenHash]);
  if(!lookup)throw new ResetError('RESET_INVALID');
  const passwordHash=await hashPassword(password);
  const result=await doTransaction(async(connection,commit)=>{
   // Lock user before token in both paths to avoid inverted lock ordering.
   const [[user]]=await connection.query(`SELECT ${fields} FROM users u WHERE u.id=? FOR UPDATE`,[lookup.userId]);
   const [[reset]]=await connection.query('SELECT tokenHash,emailSnapshot,passwordSnapshot,expiresAt FROM passwordResetTokens WHERE userId=? FOR UPDATE',[lookup.userId]);
   if(!reset || reset.tokenHash!==tokenHash || !reset.expiresAt || new Date(reset.expiresAt).getTime()<=now() ||
    !eligible(user,bannedUsers) || reset.emailSnapshot!==user.email || reset.passwordSnapshot!==user.passwordHash)throw new ResetError('RESET_INVALID');
   if(!validPassword(password,user,commonPasswords))throw new ResetError('INVALID_PASSWORD');
   const revokedBeforeMs=now();
   await connection.query('UPDATE users SET passwordHash=?,lastLogout=? WHERE id=?',[passwordHash,new Date(revokedBeforeMs),user.id]);
   const [updated]=await connection.query('UPDATE passwordResetTokens SET tokenHash=NULL,expiresAt=NULL,passwordSnapshot=NULL,revokedBeforeMs=? WHERE userId=? AND tokenHash=?',[revokedBeforeMs,user.id,tokenHash]);
   if(updated.affectedRows!==1)throw new ResetError('RESET_INVALID');
   await commit();
   return {id:String(user.id),email:user.email,revokedBeforeMs};
  });
  lastLogouts[result.id]=result.revokedBeforeMs;
  try{revokeSockets(result.id);}catch{console.error('Password reset: socket revocation failed');}
  // Notification failure must not roll back a committed password change.
  void Promise.resolve().then(()=>sendEmail({to:result.email,subject:'Your GalaxyBets password was changed',text:'Your GalaxyBets password was reset. Existing sessions have been signed out. If this was not you, contact GalaxyBets support immediately.'})).catch(()=>console.error('Password reset: confirmation email failed'));
  return {success:true};
 }
 return {request,complete};
}
function createZohoSender(env,fetcher=fetch){
 let accessToken=null,expiresAt=0,refreshing=null;
 async function access(force=false){
  if(!force && accessToken && Date.now()<expiresAt)return accessToken;
  if(refreshing)return refreshing;
  refreshing=(async()=>{
   const response=await fetcher('https://accounts.zoho.com/oauth/v2/token',{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'refresh_token',client_id:env.ZOHO_CLIENT_ID,client_secret:env.ZOHO_CLIENT_SECRET,refresh_token:env.ZOHO_REFRESH_TOKEN}),signal:AbortSignal.timeout(12000)
   });
   const data=await response.json();
   if(!response.ok || !data.access_token)throw new Error('EMAIL_AUTH_FAILED');
   accessToken=data.access_token;expiresAt=Date.now()+Math.max(1,Number(data.expires_in||3600)-60)*1000;
   return accessToken;
  })();
  try{return await refreshing;}finally{refreshing=null;}
 }
 return async mail=>{
  const send=async force=>fetcher(`https://mail.zoho.com/api/accounts/${env.ZOHO_MAIL_ACCOUNT_ID}/messages`,{
   method:'POST',headers:{Authorization:`Zoho-oauthtoken ${await access(force)}`,'Content-Type':'application/json'},
   body:JSON.stringify({fromAddress:env.PASSWORD_RESET_FROM,toAddress:mail.to,subject:mail.subject,content:mail.text,mailFormat:'plaintext',encoding:'UTF-8'}),signal:AbortSignal.timeout(12000)
  });
  let response=await send(false);
  if(response.status===401)response=await send(true);
  const data=await response.json();
  if(!response.ok || Number(data.status?.code)!==200)throw new Error('EMAIL_DELIVERY_FAILED');
 };
}
function installPasswordReset(router,deps){
 const env=deps.env||process.env;
 let url;
 try{url=new URL(env.PASSWORD_RESET_SITE_URL||'https://galaxybets.casino');}catch{}
 const configured=env.PASSWORD_RESET_ENABLED==='1' && !!env.ZOHO_CLIENT_ID && !!env.ZOHO_CLIENT_SECRET && !!env.ZOHO_REFRESH_TOKEN && /^[0-9]+$/.test(env.ZOHO_MAIL_ACCOUNT_ID||'') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.PASSWORD_RESET_FROM||'') &&
  !/[\r\n]/.test(env.PASSWORD_RESET_FROM) && url && url.protocol==='https:' && !url.username && !url.password && url.pathname==='/' && !url.search && !url.hash;
 const allowed=new Set(['https://galaxybets.casino','https://www.galaxybets.casino',url?.origin,env.FRONTEND_URL].filter(Boolean).map(x=>String(x).replace(/\/$/,'')));
 if(env.NODE_ENV==='development'){allowed.add('http://localhost:3000');allowed.add('http://localhost');}
 const service=createPasswordResetService({...deps,siteUrl:url?.origin,sendEmail:deps.sendEmail||createZohoSender(env)});
 const emailKey=req=>digest(String(req.body?.email||'').trim().toLowerCase());
 const ipKey=req=>ipKeyGenerator(req.ip||req.socket.remoteAddress);
 const limited=(windowMs,limit,keyGenerator)=>rateLimit({windowMs,limit,keyGenerator,standardHeaders:false,legacyHeaders:false,message:{error:'RESET_RATE_LIMITED'}});
 const requestIP=limited(15*60*1000,5,ipKey),requestEmail=limited(60*1000,1,emailKey),completeIP=limited(15*60*1000,10,ipKey);
 const pending=new Set();
 function guard(req,res,next){
  res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
  if(!configured)return res.status(503).json({error:'RESET_UNAVAILABLE'});
  if(!allowed.has(req.get('origin'))||!req.is('application/json'))return res.status(403).json({error:'RESET_ORIGIN_REJECTED'});
  next();
 }
 router.post('/password/forgot',guard,requestIP,requestEmail,(req,res)=>{
  const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
  if(!email || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'INVALID_EMAIL'});
  // A uniform response is sent before any account lookup or email delivery.
  // Bound this process's work queue in addition to the request limiters.
  if(pending.size>=50)return res.status(503).json({error:'RESET_UNAVAILABLE'});
  res.status(202).json({success:true,message:MESSAGE});
  const task=new Promise(resolve=>setImmediate(resolve)).then(()=>service.request(email)).catch(()=>console.error('Password reset request failed; check email delivery and database configuration.')).finally(()=>pending.delete(task));
  pending.add(task);
 });
 router.post('/password/reset',guard,completeIP,async(req,res)=>{
  try{const result=await service.complete(req.body?.token,req.body?.password);res.clearCookie('jwt',{secure:true,path:'/'});return res.json(result);}
  catch(error){if(error instanceof ResetError)return res.status(error.status).json({error:error.code});console.error('Password reset completion failed');return res.status(503).json({error:'RESET_UNAVAILABLE'});}
 });
 return {service,drain:()=>Promise.allSettled([...pending])};
}
module.exports={installPasswordReset,createPasswordResetService,createZohoSender,isResetRevoked,validPassword,ResetError};
