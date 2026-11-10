'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const manifest=require('./drop-cutouts-manifest.json');
function validateCutouts(root){
 const names=new Set();
 for(const image of manifest.images){
  if(!/^\/public\/drop-cutouts\/(irl-[a-z0-9-]+|chase-macpro)\.webp$/.test(image.image)||names.has(image.image))throw Error('Invalid cutout manifest');
  names.add(image.image);const file=path.join(root,image.image.slice(1));
  if(!fs.existsSync(file))throw Error('Missing cleaned image: '+image.image);
  const data=fs.readFileSync(file);
  if(crypto.createHash('sha256').update(data).digest('hex')!==image.sha256)throw Error('Cleaned image is incomplete or differs: '+image.image);
 }
 return manifest.images.length;
}
module.exports={validateCutouts};
