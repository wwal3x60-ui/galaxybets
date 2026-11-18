'use strict';

// Public catalogue metadata only. Sessions, balances and launches stay protected.
function selectFeatured(games) {
 const seen=new Set(),result=[];
 for(const game of Array.isArray(games)?games:[]) {
  if(!game||typeof game.id!=='string'||!game.id||typeof game.name!=='string'||!game.name.trim()||seen.has(game.id))continue;
  const image=typeof game.image==='string'?game.image:'';
  if(!/^https:\/\//i.test(image))continue;
  seen.add(game.id);
  result.push({id:game.id,name:game.name,provider:typeof game.provider==='string'?game.provider:'',image});
  if(result.length===7)break;
 }
 return result;
}

function createFeaturedHandler(getContext,now=Date.now) {
 let cached=null,expires=0,pending=null,retryAfter=0;
 return async function featuredSlots(_req,res) {
  try {
   // Check the switch on every request, even while a catalogue is cached.
   const {config,provider}=getContext();
   if(!config.enabled)return res.status(503).set('Cache-Control','no-store').json({error:'SLOTS_UNAVAILABLE'});
   if(now()<retryAfter)return res.status(503).set('Cache-Control','no-store').json({error:'SLOTS_UNAVAILABLE'});
   if(!cached||now()>=expires) {
    if(!pending)pending=Promise.resolve().then(()=>provider.games()).then(games=>{
     cached=selectFeatured(games);expires=now()+60000;return cached;
    }).catch(error=>{retryAfter=now()+10000;throw error;}).finally(()=>{pending=null;});
    await pending;
   }
   return res.set('Cache-Control','public, max-age=30').json({games:cached});
  } catch {
   retryAfter=now()+10000;
   return res.status(503).set('Cache-Control','no-store').json({error:'SLOTS_UNAVAILABLE'});
  }
 };
}
module.exports={createFeaturedHandler,selectFeatured};
