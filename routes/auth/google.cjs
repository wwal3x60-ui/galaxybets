'use strict';
const crypto = require('node:crypto');
const { OAuth2Client } = require('google-auth-library');
const bcrypt = require('bcrypt');
const { rateLimit } = require('express-rate-limit');
const TTL = 5 * 60 * 1000;
class AuthError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
function eligible(user, bannedUsers) {
  if (!user || user.banned || user.accountLock || user.sponsorLock ||
      !['USER','STREAMER','AFFILIATE_MANAGER','MOD','DEV','ADMIN','OWNER'].includes(String(user.role).toUpperCase()) ||
      bannedUsers.has(String(user.id))) throw new AuthError('ACCOUNT_RESTRICTED', 403);
  // Do not introduce a new path around existing two-factor protection.
  if (user['2fa']) throw new AuthError('GOOGLE_2FA_UNSUPPORTED', 403);
}
function installGoogleAuth(router, deps) {
  const { sql, doTransaction, createUserSeeds, bannedUsers, issueSession } = deps;
  const env = deps.env || process.env;
  const clientId = String(env.GOOGLE_CLIENT_ID || '').trim();
  const client = deps.googleClient || new OAuth2Client();
  const compare = deps.comparePassword || bcrypt.compare;
  const hashPassword = deps.hashPassword || (s => bcrypt.hash(s, 12));
  const googleLimiter = rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:false,legacyHeaders:false,message:{error:'TOO_MANY_REQUESTS'}});
  const challengeLimiter = rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:false,legacyHeaders:false,message:{error:'TOO_MANY_REQUESTS'}});
  const allowed = new Set(['https://galaxybets.casino','https://www.galaxybets.casino',env.FRONTEND_URL].filter(Boolean).map(s=>String(s).replace(/\/$/,'')));
  if (env.NODE_ENV === 'development') { allowed.add('http://localhost:3000'); allowed.add('http://localhost:80'); allowed.add('http://localhost'); }
  function guard(req,res,next) {
    res.set('Cache-Control','no-store');
    if (!clientId || !/^[A-Za-z0-9._-]+\.apps\.googleusercontent\.com$/.test(clientId)) return res.status(503).json({error:'GOOGLE_NOT_CONFIGURED'});
    if (!allowed.has(req.get('origin')) || !req.is('application/json')) return res.status(403).json({error:'GOOGLE_ORIGIN_REJECTED'});
    next();
  }
  function fail(res,error) {
    if (error instanceof AuthError) return res.status(error.status).json({error:error.code});
    if (['ER_DUP_ENTRY','ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code)) return res.status(409).json({error:'GOOGLE_RETRY'});
    // Avoid logging credentials, ID tokens, passwords, or Google's payload.
    console.error('Google authentication failed:', /^[A-Z_]+$/.test(error.code || '') ? error.code : 'INTERNAL_ERROR');
    return res.status(503).json({error:'GOOGLE_UNAVAILABLE'});
  }
  router.post('/google/challenge',challengeLimiter,guard,async(req,res)=>{
    try {
      const nonce = crypto.randomBytes(32).toString('hex');
      await sql.query('DELETE FROM googleAuthChallenges WHERE expiresAt < NOW() LIMIT 100');
      await sql.query('INSERT INTO googleAuthChallenges (nonce, expiresAt) VALUES (?, ?)',[nonce,new Date(Date.now()+TTL)]);
      return res.json({nonce});
    } catch(error) { return fail(res,error); }
  });
  router.post('/google',googleLimiter,guard,async(req,res)=>{
    const {credential,nonce,password,confirm18} = req.body || {};
    if (typeof credential !== 'string' || credential.length > 16384 || typeof nonce !== 'string' || !/^[a-f0-9]{64}$/.test(nonce)) return res.status(400).json({error:'GOOGLE_INVALID_TOKEN'});
    if (password != null && (typeof password !== 'string' || Buffer.byteLength(password,'utf8') > 72)) return res.status(400).json({error:'INVALID_CREDENTIALS'});
    try {
      let payload;
      try { payload = (await client.verifyIdToken({idToken:credential,audience:clientId})).getPayload(); }
      catch { throw new AuthError('GOOGLE_INVALID_TOKEN',401); }
      if (!payload || payload.aud !== clientId || !['accounts.google.com','https://accounts.google.com'].includes(payload.iss) ||
          !Number.isFinite(payload.exp) || payload.exp*1000 <= Date.now() || payload.nonce !== nonce ||
          typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 || payload.email_verified !== true ||
          typeof payload.email !== 'string' || payload.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) throw new AuthError('GOOGLE_INVALID_TOKEN',401);
      const email = payload.email.trim().toLowerCase();
      const user = await doTransaction(async(connection,commit)=>{
        const [[challenge]] = await connection.query('SELECT nonce, expiresAt FROM googleAuthChallenges WHERE nonce = ? FOR UPDATE',[nonce]);
        if (!challenge || new Date(challenge.expiresAt).getTime() <= Date.now()) throw new AuthError('GOOGLE_CHALLENGE_EXPIRED',401);
        const [[identity]] = await connection.query('SELECT userId FROM googleIdentities WHERE googleSubject = ?',[payload.sub]);
        let user;
        if (identity) {
          [[user]] = await connection.query('SELECT id, username, email, role, banned, accountLock, sponsorLock, `2fa` FROM users WHERE id = ? FOR UPDATE',[identity.userId]);
          eligible(user,bannedUsers);
        } else {
          [[user]] = await connection.query('SELECT id, username, email, passwordHash, role, banned, accountLock, sponsorLock, `2fa` FROM users WHERE email = ? FOR UPDATE',[email]);
          if (user) {
            eligible(user,bannedUsers);
            if (!password) throw new AuthError('GOOGLE_LINK_PASSWORD_REQUIRED',409);
            if (!await compare(password,user.passwordHash)) throw new AuthError('INVALID_CREDENTIALS',401);
          } else {
            if (confirm18 !== true) throw new AuthError('CONFIRM_18_REQUIRED',400);
            const username = 'player_' + crypto.randomBytes(6).toString('hex');
            // Google-only accounts have an unguessable random password, never a shared default.
            const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
            const country = /^[A-Z]{2}$/.test(req.get('cf-ipcountry') || '') ? req.get('cf-ipcountry') : null;
            const [insert] = await connection.query('INSERT INTO users (username,email,passwordHash,ip,country) VALUES (?,?,?,?,?)',[username,email,passwordHash,req.ip,country]);
            user = {id:String(insert.insertId),username,email,role:'USER'};
            await createUserSeeds(String(user.id),connection);
          }
          await connection.query('INSERT INTO googleIdentities (googleSubject,userId) VALUES (?,?)',[payload.sub,String(user.id)]);
        }
        await connection.query('UPDATE users SET ip = ? WHERE id = ?',[req.ip,String(user.id)]);
        await connection.query('DELETE FROM googleAuthChallenges WHERE nonce = ?',[nonce]);
        await commit();
        return user;
      });
      return issueSession(res,user);
    } catch(error) { return fail(res,error); }
  });
}
module.exports = {installGoogleAuth,eligible,AuthError};
