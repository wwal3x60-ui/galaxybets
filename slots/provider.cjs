'use strict';
const {hmac,error,catalogue}=require('./protocol.cjs');
class Provider {
 constructor(config,fetchImpl=fetch){this.config=config;this.fetch=fetchImpl;this.cache=null;this.loading=null;}
 async call(path,{method='GET',body,launch=false}={}) {
  const ts=String(Math.floor(Date.now()/1000));
  const headers={AppID:this.config.appId,Ts:ts,Sign:hmac(this.config.secret,[this.config.appId,ts,method,path].join('|')),'Content-Type':'application/json'};
  let response;
  try{response=await this.fetch((launch?'https://launch-ops.codejackpot.online':'https://api.codejackpot.online')+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),redirect:'error'});}catch{throw error('PROVIDER_UNAVAILABLE',502);}
  let value;try{value=await response.json();}catch{throw error('INVALID_PROVIDER_RESPONSE',502);}
  const bareCatalogue=path==='/v1/games' && method==='GET' && Array.isArray(value);
  if(!response.ok || (!bareCatalogue && Number(value?.code)!==0)) throw error('PROVIDER_ERROR_'+String(value?.code??response.status).replace(/[^0-9]/g,''),502);
  return value;
 }
 async games(force=false) {
  if(!force && this.cache && Date.now()-this.cache.time<300000)return this.cache.games;
  if(this.loading)return this.loading;
  this.loading=this.call('/v1/games').then(value=>{const games=catalogue(value);this.cache={time:Date.now(),games};return games;}).finally(()=>{this.loading=null;});return this.loading;
 }
 async launch(userId,gameId,platform) {
  const value=await this.call('/api/v1/game/launch',{method:'POST',launch:true,body:{UserID:String(userId),GameID:gameId,Language:'en',Platform:platform,Mode:'real',Currency:'USD'}});
  let url;try{url=new URL(value?.data?.Url);}catch{throw error('INVALID_LAUNCH_URL',502);}
  if(url.protocol!=='https:' || url.username || url.password)throw error('INVALID_LAUNCH_URL',502);
  return url.href;
 }
}
module.exports={Provider};
