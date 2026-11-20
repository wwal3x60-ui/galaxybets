import { apiClient } from "./client";
import { normalizeLiveOpen,type LiveDrop } from "@/lib/live-open-view";
async function read(path:string,limit:number,max:number):Promise<LiveDrop[]>{const safe=Math.min(max,Math.max(1,Math.floor(Number.isFinite(limit)?limit:3)));const res=await apiClient.get(path,{params:{limit:safe}});if(!res.data?.success||!Array.isArray(res.data.data))throw new Error('Live drops are unavailable');return res.data.data.map(normalizeLiveOpen).filter((item:LiveDrop|null):item is LiveDrop=>item!==null);}
export function getLiveOpens(limit=16):Promise<LiveDrop[]>{return read('/live-opens',limit,20);}
export function getTopOpens(limit=3):Promise<LiveDrop[]>{return read('/live-opens/top',limit,10);}
