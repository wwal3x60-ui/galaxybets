'use strict';
const ADMIN_ROLES = new Set(['ADMIN', 'OWNER', 'DEV']);

function tokenFrom(req) {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header) return header.replace(/^Bearer\s+/i, '');
  const cookie = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('gb_admin_session='));
  if (!cookie) return null;
  try { return decodeURIComponent(cookie.slice('gb_admin_session='.length)); } catch { return null; }
}

// A deadline owns only this read's connection. Never replay writes or destroy
// a connection returned to the pool; release a late acquisition without using it.
function boundedRead(pool, statement, values, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let settled = false, connection = null, destroyed = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (connection) { destroyed = true; connection.destroy(); }
      reject(Object.assign(new Error('Admin verification timed out'), {code:'ADMIN_DB_TIMEOUT'}));
    }, timeout);
    Promise.resolve().then(() => pool.getConnection()).then(async acquired => {
      if (settled) { acquired.release(); return; }
      connection = acquired;
      try {
        const result = await acquired.query({sql: statement, timeout}, values);
        if (!settled) { settled = true; clearTimeout(timer); resolve(result); }
      } catch (error) {
        if (error.fatal || ['ECONNRESET','ETIMEDOUT','PROTOCOL_CONNECTION_LOST','PROTOCOL_SEQUENCE_TIMEOUT'].includes(error.code)) {
          if (!destroyed) { destroyed = true; acquired.destroy(); }
        }
        if (!settled) { settled = true; clearTimeout(timer); reject(error); }
      } finally { if (!destroyed) acquired.release(); }
    }).catch(error => {
      if (!settled) { settled = true; clearTimeout(timer); reject(error); }
    });
  });
}

function eligible(user) { return !!user && ADMIN_ROLES.has(String(user.role).trim().toUpperCase()) && !Number(user.banned) && !Number(user.accountLock); }
function active(user, claims) {
  if (!eligible(user) || claims.maintenanceAdmin !== true) return false;
  if (user['2fa'] && claims.maintenanceMfa !== true) return false;
  const issued = Number(claims.authTime);
  const cutoff = Math.max(Number(user.revokedBeforeMs || 0), user.lastLogout ? new Date(user.lastLogout).getTime() : 0);
  return Number.isFinite(issued) && Number.isFinite(cutoff) && issued > cutoff;
}

function createAuth({pool, jwt, bcrypt, speakeasy, secret}) {
  function requireSecret() {
    if (typeof secret !== 'string' || secret.length < 32) throw Object.assign(new Error('Admin authentication unavailable'),{code:'ADMIN_AUTH_UNAVAILABLE'});
  }
  async function verify(token) {
    if (!token || token.length > 4096) return null;
    requireSecret();
    let claims;
    try { claims = jwt.verify(token, secret, {algorithms:['HS256']}); } catch { return null; }
    if (!claims || !/^\d+$/.test(String(claims.uid)) || claims.maintenanceAdmin !== true) return null;
    const [[user]] = await boundedRead(pool, 'SELECT u.id,u.username,u.role,u.banned,u.accountLock,u.lastLogout,u.`2fa`,r.revokedBeforeMs FROM users u LEFT JOIN passwordResetTokens r ON r.userId=u.id WHERE u.id=?', [claims.uid]);
    return active(user, claims) ? {id:String(user.id),username:user.username,role:user.role} : null;
  }
  async function login(body) {
    requireSecret();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || email.length > 254 || !password || Buffer.byteLength(password) > 72) return null;
    const [[user]] = await boundedRead(pool, 'SELECT id,username,role,banned,accountLock,passwordHash,`2fa` FROM users WHERE email=?', [email]);
    const dummy = '$2b$12$JVYEkrn6akHPT/ewBYDBt.vjNopkpvUp8yp9lijt1SAzmxsX./fSG';
    const matches = await bcrypt.compare(password, user ? user.passwordHash : dummy);
    if (!matches || !eligible(user)) return null;
    if (user['2fa'] && (!/^\d{6}$/.test(String(body.otp || '')) || !speakeasy.totp.verify({secret:user['2fa'],encoding:'base32',token:String(body.otp),window:1}))) return null;
    const token = jwt.sign({uid:String(user.id),authTime:Date.now(),maintenanceAdmin:true,maintenanceMfa:!!user['2fa']}, secret, {algorithm:'HS256',expiresIn:'1h'});
    return {token,user:{id:String(user.id),username:user.username,role:user.role}};
  }
  return {verify,login};
}
module.exports = {createAuth, boundedRead, tokenFrom, active, eligible};
