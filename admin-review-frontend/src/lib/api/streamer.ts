import {apiClient} from './client';
export interface StreamerStats{code:string|null;from:string;to:string;summary:{referrals:number;wagered:string;payouts:string;games:number;deposited:string;withdrawn:string;depositCount:number};page:number;limit:number;total:number;players:Array<{id:string;username:string;anonymous:boolean;wagered:string;payouts:string;net:string;games:number;deposited:string;withdrawn:string;depositCount:number}>}
export interface StreamerKey{id:string;label:string;prefix:string;createdAt:string;expiresAt:string;revokedAt:string|null;lastUsedAt:string|null}
export async function streamerMe(){return(await apiClient.get('/streamer/me')).data as {username:string;role:string;code:string|null};}
export async function streamerStats(from:string,to:string,page=1,allTime=false){return(await apiClient.get('/streamer/stats',{params:allTime?{allTime:'1',page,limit:25}:{from,to,page,limit:25}})).data as StreamerStats;}
export async function streamerKeys(){return(await apiClient.get('/streamer/keys')).data.keys as StreamerKey[];}
export async function createStreamerKey(label:string){return(await apiClient.post('/streamer/keys',{label})).data as {token:string;id:string;expiresAt:string};}
export async function revokeStreamerKey(id:string){return apiClient.delete('/streamer/keys/'+encodeURIComponent(id));}
