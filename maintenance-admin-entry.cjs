// GB_LEGACY_RETIRE_V1
'use strict';
const path=require('node:path');
const {fork}=require('node:child_process');
function boot(){
  require('dotenv').config({quiet:true});
  const {createAuth}=require('./maintenance-admin/auth.cjs');
  const {createGateway}=require('./maintenance-admin/gateway.cjs');
  const {sql}=require('./database');
  const retirement=require('./maintenance-admin/retire-legacy.cjs').start({pool:sql,quote:(...args)=>require('./utils/funded-battles').quote(...args)});
  process.once('SIGTERM',()=>retirement.stop());process.once('SIGINT',()=>retirement.stop());
  const port=Number(process.env.PORT||3001);
  const upstreamPort=port===3002?3003:3002;
  const auth=createAuth({pool:sql,jwt:require('jsonwebtoken'),bcrypt:require('bcrypt'),speakeasy:require('speakeasy'),secret:process.env.JWT_SECRET});
  const server=createGateway({auth,upstreamPort,publicAccess:true});
  let child;
  server.listen(port,'0.0.0.0',()=>{
    console.log('GalaxyBets public access is ON. Application authentication remains enforced. Listening on port '+port);
    // The public maintenance listener starts before the app or its caches.
    child=fork(path.join(__dirname,'app.js'),[],{env:{...process.env,PORT:String(upstreamPort),HOST:'127.0.0.1',ENABLE_JACKPOT_BOTS:'0'},stdio:'inherit'});
    child.on('error',error=>console.error('Admin backend unavailable:',error.code||'UNKNOWN'));
    child.on('exit',code=>console.error('Admin backend exited:',code));
  });
  server.on('error',error=>{console.error('Maintenance listener failed:',error.code||'UNKNOWN');process.exitCode=1;});
  let closing=false;
  function shutdown(){if(closing)return;closing=true;if(child)child.kill('SIGTERM');server.close();server.closeAllConnections();sql.end().catch(()=>{});setTimeout(()=>process.exit(0),25000).unref();}
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
  return server;
}
if(require.main===module)boot();
module.exports={boot};
