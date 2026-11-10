'use strict';
const fs=require('fs/promises'),path=require('path'),sharp=require('sharp');
sharp.concurrency(1);sharp.cache({memory:24,files:0,items:20});
async function main(root=path.join(__dirname,'../public')){
 let count=0,before=0,after=0;
 for(const group of ['packs','drop-images','drop-cutouts']){
  const input=path.join(root,group),output=path.join(root,'optimized-v1',group);
  let names;try{names=await fs.readdir(input)}catch(e){if(e.code==='ENOENT')continue;throw e}
  await fs.mkdir(output,{recursive:true});
  for(const name of names){
   if(!/^[a-zA-Z0-9_.-]+\.(png|jpe?g|webp|avif)$/i.test(name))continue;
   const source=path.join(input,name),target=path.join(output,name+'.webp');
   const stat=await fs.stat(source);if(!stat.isFile())continue;
   // Preserve alpha; never enlarge an input. Cards and products stay sharp at 2x display size.
   await sharp(source,{limitInputPixels:40000000}).rotate().resize({width:group==='packs'?480:384,height:group==='packs'?720:576,fit:'inside',withoutEnlargement:true}).webp({quality:84,alphaQuality:100,effort:3}).toFile(target);
   before+=stat.size;after+=(await fs.stat(target)).size;count++;
  }
 }
 if(!count)throw Error('No pack/drop assets found. Build media from the real backend project, which contains public/packs and public/drop-images.');
 console.log(JSON.stringify({optimizedImages:count,originalBytes:before,optimizedBytes:after,reduction:((1-after/before)*100).toFixed(1)+'%'}));
}
if(require.main===module)main().catch(e=>{console.error('Media build:',e.message);process.exitCode=1});
module.exports={main};
