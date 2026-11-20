import { cleanedDropImage } from "@/lib/utils/drop-cutouts";
import { websocketManager, type LiveOpenItem } from "@/lib/websocket";
export type LiveDrop=LiveOpenItem&{packId?:string;packName?:string;user:LiveOpenItem['user']&{isBot?:boolean}};
export function normalizeLiveOpen(raw: any): LiveDrop|null {
 if(!raw?.id||!raw?.name)return null;
 let image=cleanedDropImage(raw.image);
 if(image&&!/^(https?:|data:|blob:)/i.test(image)&&!image.startsWith('/api/v1/'))image='/api/v1'+(image.startsWith('/')?'':'/')+image;
 return {id:String(raw.id),openedAt:String(raw.openedAt||''),name:String(raw.name),price:String(raw.price??'0'),image,packId:raw.packId?String(raw.packId):undefined,packName:String(raw.packName||''),user:{name:String(raw.user?.name||'Anonymous'),avatar:String(raw.user?.avatar||''),isBot:raw.user?.isBot===true}};
}
function newest(a:LiveDrop,b:LiveDrop){if(/^\d+$/.test(a.id)&&/^\d+$/.test(b.id)){const x=BigInt(a.id),y=BigInt(b.id);return x>y?-1:x<y?1:0;}return 0;}
export function mergeDrops(current:LiveDrop[],incoming:LiveDrop[],limit:number,top=false):LiveDrop[]{const map=new Map<string,LiveDrop>();for(const item of [...incoming,...current])if(!map.has(item.id))map.set(item.id,item);return [...map.values()].sort((a,b)=>top?(Number(b.price)-Number(a.price)||newest(a,b)):newest(a,b)).slice(0,limit);}
export function subscribeLiveOpens(onOpen:(item:LiveDrop)=>void,onConnection?:(connected:boolean)=>void):()=>void {
 let attached:ReturnType<typeof websocketManager.getSocket>=null;let detach=()=>{};let active=true;
 const off=websocketManager.subscribeStatus(status=>{if(!active)return;onConnection?.(status.connected);if(!status.connected)return;const socket=websocketManager.getSocket();if(!socket||attached===socket)return;detach();attached=socket;const receive=(event:any)=>{const item=normalizeLiveOpen(event?.item);if(item)onOpen(item);};socket.on('live-open:new',receive);detach=()=>socket.off('live-open:new',receive);});
 return()=>{active=false;off();detach();};
}
