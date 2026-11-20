import {apiClient} from './client';
import {useAuthStore} from '@/store/auth.store';
import type {StreamerStats} from './streamer';
export type ManagerSummary={id:string;username:string;role:string;ratePercent:number;budget:string;granted:string;commissionEarned:string;commissionClaimed:string;claimable:string;streamers:number;grantWagering:string};
export type ManagedStreamer={id:string;username:string;code:string|null;balance:string|null;notes:string|null;assignedAt:string|null;managerEarned:string;banned:number;accountLock:number};
export type StreamerPage={streamers:ManagedStreamer[];total:number;page:number;limit:number};
export type ManagerEvent={id:string;actorId:string;streamerId:string|null;kind:string;amount:string;note:string;createdAt:string};
export type EventPage={events:ManagerEvent[];page:number;hasMore:boolean};
export type ManagerRow={id:string;username:string;budget:string;granted:string;commissionEarned:string;streamers:number;banned:number;accountLock:number};
export const managerSummary=async()=>(await apiClient.get('/manager/me')).data as ManagerSummary;
export const managerStreamers=async(page:number,search:string,available=false)=>(await apiClient.get(available?'/manager/available':'/manager/streamers',{params:{page,search}})).data as StreamerPage;
export const managerEvents=async(page:number,managerId?:string)=>(await apiClient.get(managerId?'/admin/affiliate-managers/events':'/manager/events',{params:{page,...(managerId?{managerId}:{})}})).data as EventPage;
export const adminManagers=async()=>(await apiClient.get('/admin/affiliate-managers')).data.managers as ManagerRow[];
export const managedStats=async(id:string)=>(await apiClient.get('/manager/streamers/'+encodeURIComponent(id)+'/stats',{params:{allTime:'1',limit:25,page:1}})).data as StreamerStats;
export async function managerAction(action:string,body:Record<string,string>,admin=false){
 const actor=useAuthStore.getState().user?.id||'session';
 const storageKey='gb-manager-request:'+actor+':'+JSON.stringify({action,body,admin});
 let requestId='';try{requestId=sessionStorage.getItem(storageKey)||'';}catch{}
 if(!requestId){requestId=crypto.randomUUID();try{sessionStorage.setItem(storageKey,requestId);}catch{}}
 const response=await apiClient.post((admin?'/admin/affiliate-managers/':'/manager/')+action,{...body,requestId});
 if(response.data?.success!==true)throw Error(response.data?.error||'UPDATE_NOT_CONFIRMED');
 try{sessionStorage.removeItem(storageKey);}catch{}
 return response.data as {success:true;amount?:string;reused?:boolean};
}
export function managerError(error:unknown){const e=error as {response?:{data?:{error?:string}};message?:string};const code=e.response?.data?.error||e.message;const messages:Record<string,string>={MANAGER_ONLY:'This dashboard requires the Affiliate Manager role. An administrator can assign it in Users.',ADMIN_ONLY:'Administrator access is required.',MANAGER_BUDGET_EXCEEDED:'The grant exceeds your available budget. Ask an administrator to allocate more.',STREAMER_ALREADY_ASSIGNED:'This streamer already belongs to a manager. Refresh the list.',STREAMER_NOT_ASSIGNED_TO_YOU:'This streamer is not assigned to you.',STREAMER_UNAVAILABLE:'The streamer account is restricted or no longer has the Streamer role.',NO_CLAIMABLE_COMMISSION:'You need at least $0.01 in commission to claim.',REASON_REQUIRED:'Add a reason for this transfer.',INVALID_AMOUNT:'Enter an amount from $0.01 to $1,000,000 with at most two decimal places.',REQUEST_ID_REUSED:'This request changed after submission. Check the activity log before submitting a new transfer.'};return code&&messages[code]?messages[code]:'The request could not be confirmed. Refresh the activity log before changing or repeating a transfer. Retrying the same request uses the same reference.';}
