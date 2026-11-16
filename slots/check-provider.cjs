'use strict';
require('dotenv').config({quiet:true});
const {Provider}=require('./provider.cjs');
const config=require('./config.cjs')();
(async()=>{try{
 const provider=new Provider(config);
 const args=process.argv.slice(2),position=args.indexOf('--wallet-url');
 if(position>=0){
  const url=new URL(args[position+1]);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/slots/wallet')throw Error('Use https://YOUR-BACKEND-HOST/slots/wallet without a query string');
  await provider.call('/v1/wallet',{method:'PUT',body:{walletUrl:url.href}});
  console.log('Provider wallet callback URL updated.');
 }
 if(args.includes('--wallet-test')){
  const result=await provider.call('/v1/wallet/test',{method:'POST',body:{}});
  console.log('Provider wallet test returned code:',result.code);
  console.log('Test result:',JSON.stringify(result.data));
 }else{
  const games=await provider.games();console.log('Catalogue connected. Games available:',games.length);console.log('Sample fields:',games.slice(0,3).map(g=>({id:g.id,name:g.name,provider:g.provider})));
 }
}catch(e){console.error('Provider check stopped:',e.publicError||e.message);process.exitCode=1;}})();
