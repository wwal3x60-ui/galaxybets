// GB_CS2_ARENA_V1
// GB_LEGACY_RETIRE_V1
'use strict';
const http = require('node:http');
const {tokenFrom} = require('./auth.cjs');
const notice = {error:'SITE_MAINTENANCE',message:'GalaxyBets is under maintenance. Please check back soon.'};
const socketOrigins = new Set(['https://galaxybets.casino','https://www.galaxybets.casino','http://localhost:3000','http://127.0.0.1:3000',process.env.FRONTEND_URL].filter(Boolean));
const security = {'Cache-Control':'no-store','CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff','Retry-After':'300'};
const html = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GalaxyBets | Maintenance</title><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#101113;color:#f6f6f6;font:16px system-ui}main{max-width:560px;padding:40px}b{color:#ed4055}h1{font-size:44px;letter-spacing:-2px}p{color:#adb0b8;line-height:1.7}</style><main><strong>GALAXY<b>BETS</b></strong><h1>We’ll be back soon.</h1><p>We’re working on GalaxyBets. Please check back soon.</p></main></html>';
function send(req,res,status,data) {
  if (res.destroyed) return;
  res.writeHead(status,{...security,'Content-Type':'application/json; charset=utf-8'});
  res.end(req.method === 'HEAD' ? undefined : JSON.stringify(data));
}
async function bodyJson(req) {
  const parts=[]; let size=0;
  for await (const part of req) { size+=part.length; if(size>8192) throw Object.assign(new Error('Request too large'),{code:'BODY_TOO_LARGE'}); parts.push(part); }
  return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
function createGateway({auth, upstreamPort, clock=Date.now}) {
  const attempts=new Map(); const tunnels=new Set();
  function loginAllowed(req) {
    // Render supplies X-Forwarded-For; the rightmost client-facing hop is used.
    const forwarded=String(req.headers['x-forwarded-for']||'').split(',').map(s=>s.trim()).filter(Boolean);
    const key=forwarded.at(-1)||req.socket.remoteAddress||'unknown';
    const now=clock();
    if(attempts.size>4096) for(const [ip,v] of attempts) if(now-v.time>60000) attempts.delete(ip);
    const previous=attempts.get(key);
    if(previous && now-previous.time<60000) { if(previous.count>=5)return false; previous.count++; return true; }
    if(attempts.size>=4096)return false;
    attempts.set(key,{time:now,count:1});return true;
  }
  const server=http.createServer(async(req,res)=>{
    let pathname;
    try { pathname=new URL(req.url,'http://maintenance.invalid').pathname; } catch { return send(req,res,400,{error:'BAD_REQUEST'}); }
    if(pathname==='/health' && ['GET','HEAD'].includes(req.method)) return send(req,res,200,{ok:true,maintenance:true,adminOnly:true,version:'gb-admin-maint-v1',arenaVersion:'gb-cs2-arena-v1',legacyBattleRetirement:'gb-legacy-retire-v1',refundDatabaseFingerprint:require('./retire-legacy.cjs').status().databaseFingerprint,crossOriginAdminPolling:true});
    // Browser polling uses a JWT Authorization header across the Vercel/Render origins.
    // A successful preflight exposes no game data; every real poll is admin-verified.
    if(pathname==='/socket.io/' && req.method==='OPTIONS' && socketOrigins.has(req.headers.origin)) {
      res.writeHead(204,{...security,'Access-Control-Allow-Origin':req.headers.origin,'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'});
      return res.end();
    }
    if(pathname==='/maintenance/login' && req.method==='POST') {
      if(!loginAllowed(req)) return send(req,res,429,{error:'TOO_MANY_ATTEMPTS',message:'Wait one minute before trying again.'});
      try {
        const result=await auth.login(await bodyJson(req));
        return send(req,res,result?200:401,result||{error:'INVALID_CREDENTIALS',message:'Check your admin credentials and authenticator code.'});
      } catch(error) {
        if(error instanceof SyntaxError || error.code==='BODY_TOO_LARGE')return send(req,res,400,{error:'INVALID_REQUEST'});
        console.error('Maintenance login unavailable:',error.code||'UNKNOWN');
        return send(req,res,503,{error:'ADMIN_AUTH_UNAVAILABLE',message:'Admin verification is temporarily unavailable. Try again shortly.'});
      }
    }
    const token=tokenFrom(req); let user=null;
    try { if(token)user=await auth.verify(token); }
    catch(error) { console.error('Maintenance access unavailable:',error.code||'UNKNOWN'); return send(req,res,503,{error:'ADMIN_AUTH_UNAVAILABLE'}); }
    if(pathname==='/maintenance/access' && ['GET','HEAD'].includes(req.method)) return send(req,res,user?200:401,user?{admin:true,user}:{error:'UNAUTHORIZED'});
    if(!user) {
      if((req.headers.accept||'').includes('text/html') && ['GET','HEAD'].includes(req.method)) {
        res.writeHead(503,{...security,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"});
        return res.end(req.method==='HEAD'?undefined:html);
      }
      return send(req,res,503,notice);
    }
    // No application request is forwarded until current admin authority is verified.
    const headers={...req.headers,authorization:token};delete headers['proxy-authorization'];
    const upstream=http.request({host:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers},incoming=>{
      res.writeHead(incoming.statusCode,{...incoming.headers,'Cache-Control':'no-store'});incoming.pipe(res);
    });
    upstream.setTimeout(30000,()=>upstream.destroy(Object.assign(new Error('Upstream timeout'),{code:'ETIMEDOUT'})));
    upstream.on('error',()=>{ if(!res.headersSent)send(req,res,503,{error:'ADMIN_BACKEND_STARTING',message:'Admin sign-in succeeded, but the game backend is still starting.'});else res.destroy(); });
    req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
  });
  server.headersTimeout=15000;server.requestTimeout=30000;
  server.on('upgrade',async(req,socket,head)=>{
    const token=tokenFrom(req);let user;
    try { user=await auth.verify(token); } catch {}
    if(!user || !req.url.startsWith('/socket.io/'))return socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
    const upstream=http.request({host:'127.0.0.1',port:upstreamPort,path:req.url,headers:{...req.headers,authorization:token}});
    upstream.on('upgrade',(response,remote,remoteHead)=>{
      const lines=Object.entries(response.headers).flatMap(([k,v])=>Array.isArray(v)?v.map(x=>k+': '+x):[k+': '+v]);
      socket.write('HTTP/1.1 101 Switching Protocols\r\n'+lines.join('\r\n')+'\r\n\r\n');
      if(remoteHead.length)socket.write(remoteHead);if(head.length)remote.write(head);
      tunnels.add(socket);socket.pipe(remote).pipe(socket);
      let checking=false;
      const timer=setInterval(async()=>{if(checking)return;checking=true;try{if(!await auth.verify(token))socket.destroy();}catch{socket.destroy();}finally{checking=false;}},15000);
      function close(){clearInterval(timer);tunnels.delete(socket);socket.destroy();remote.destroy();}
      socket.on('close',close);remote.on('close',close);socket.on('error',close);remote.on('error',close);
    });
    upstream.on('response',r=>{r.resume();socket.destroy();});
    upstream.setTimeout(10000,()=>upstream.destroy());upstream.on('error',()=>socket.destroy());upstream.end();
  });
  server.on('close',()=>{for(const socket of tunnels)socket.destroy();});
  return server;
}
module.exports={createGateway};
