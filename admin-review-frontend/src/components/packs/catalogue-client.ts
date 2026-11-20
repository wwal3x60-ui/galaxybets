import {apiClient} from '@/lib/api/client';
import {cleanedDropImage} from '@/lib/utils/drop-cutouts';
import type {Pack as ExistingPack,GetPacksFilters,PackCategory} from '@/lib/api/packs';
export type {GetPacksFilters,PackCategory};
export type Pack=ExistingPack&{risk:'Low'|'High'|null};
export async function getPacks(filters:GetPacksFilters={}){
 try{
  const res=await apiClient.get('/user/pack-catalogue',{params:filters});
  if(res.data.version!=='pack-risk-v1')throw Error('The case catalogue backend needs updating.');
  const packs:Pack[]=res.data.packs.map((p:{id:string;name:string;price:string;img:string;itemCount:number;category:Exclude<PackCategory,'All'>;isOfficial:boolean;risk:Pack['risk']})=>{const src=cleanedDropImage(p.img);return{id:p.id,name:p.name,price:Number(p.price).toLocaleString('en-US',{style:'currency',currency:'USD'}),openPrice:p.price,image:!src?'':/^(https?:|data:|blob:)/i.test(src)?src:src.startsWith('/api/v1/')?src:`/api/v1${src.startsWith('/')?'':'/'}${src}`,itemCount:p.itemCount,category:p.category,isOfficial:p.isOfficial,risk:p.risk};});
  return{packs,total:res.data.total as number,hasMore:res.data.hasMore as boolean,limit:res.data.limit as number,offset:res.data.offset as number};
 }catch(e:unknown){const status=(e as {response?:{status?:number}})?.response?.status;throw Error(status===404?'The case catalogue backend needs updating. Restart with the latest RUN-LOCAL.ps1.':status===429?'Please wait a moment and refresh the case list.':'The case catalogue could not be loaded. Please try again.');}
}
