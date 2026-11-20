'use strict';
const fs=require('node:fs'),path=require('node:path');
// GB_ADMIN_MAINT_DISPATCH_V1
function boot({directory=__dirname,env=process.env,loadApp=()=>require('./app.js')}={}){
 let config={enabled:true};
 try{config=JSON.parse(fs.readFileSync(path.join(directory,'maintenance/config.json'),'utf8'));}catch{}
 if(config.enabled===false)return loadApp();
 if(config.mode==='admin')return require('./maintenance-admin-entry.cjs').boot();
 const {createMaintenanceServer}=require('./maintenance/server.cjs');
 const port=env.PORT===undefined?3001:Number(env.PORT);
 return createMaintenanceServer().listen(port,env.HOST||'0.0.0.0',()=>console.log('GalaxyBets maintenance is ON. API and socket access are closed.'));
}
if(require.main===module){require('dotenv').config();boot();}
module.exports={boot};
