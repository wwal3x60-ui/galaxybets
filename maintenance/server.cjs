'use strict';
const http=require('node:http');
const {html,headers,message}=require('./page.cjs');
function createMaintenanceServer(){
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://maintenance.invalid').pathname;
  // Hosting liveness only. No account, database or financial information.
  if(pathname==='/health'&&['GET','HEAD'].includes(req.method)){
   res.writeHead(200,{...headers,'Content-Type':'application/json; charset=utf-8'});
   res.end(req.method==='HEAD'?undefined:JSON.stringify({ok:true,maintenance:true}));return;
  }
  const json=pathname.startsWith('/api/')||pathname.startsWith('/socket.io/')||!['GET','HEAD'].includes(req.method)||!(req.headers.accept||'').includes('text/html');
  res.writeHead(503,{...headers,'Content-Type':json?'application/json; charset=utf-8':'text/html; charset=utf-8'});
  res.end(req.method==='HEAD'?undefined:json?JSON.stringify(message):html);
 });
 server.on('upgrade',(_req,socket)=>{
  socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nCache-Control: no-store\r\nRetry-After: 300\r\nContent-Length: 0\r\n\r\n');
 });
 return server;
}
module.exports={createMaintenanceServer};
