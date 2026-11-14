'use strict';
const fs=require('node:fs'),path=require('node:path');
function boot({directory=__dirname,env=process.env,loadApp=()=>require('./app.js')}={}){
 // Fail closed if the switch is missing or invalid. Reopening is explicit.
 let enabled=true;
 try{enabled=JSON.parse(fs.readFileSync(path.join(directory,'maintenance/config.json'),'utf8')).enabled!==false;}catch{}
 if(!enabled)return loadApp();
 const {createMaintenanceServer}=require('./maintenance/server.cjs');
 const port=env.PORT===undefined?3001:Number(env.PORT);
 return createMaintenanceServer().listen(port,env.HOST||'0.0.0.0',()=>console.log('GalaxyBets maintenance is ON. API and socket access are closed.'));
}
if(require.main===module){require('dotenv').config();boot();}
module.exports={boot};
