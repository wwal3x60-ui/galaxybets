"use client";
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {useAuthStore} from '@/store/auth.store';
import {apiClient} from '@/lib/api/client';

export type AccountProfile={id:string;username:string;email:string;role:string;createdAt:string;emailVerified:boolean;twoFactorConfigured:boolean;firstName:string|null;lastName:string|null;birthday:string|null;address:string|null;addressAlt:string|null;city:string|null;state:string|null;country:string|null;phone:string|null};
export type WagerProgress={required:string;completed:string;remaining:string;percent:number};
export type AccountOverview={version:string;fetchedAt:string;profile:AccountProfile;balance:string;stats:{totalWagered:string;totalReturns:string;netResult:string;completedRounds:string;inventoryCount:string;inventoryValue:string;deposited:string;withdrawn:string;pendingDeposits:string;pendingWithdrawals:string};games:Array<{game:string;rounds:string;wagered:string;returnsAmount:string;netResult:string;profitableRounds:string}>;recent:Array<{id:string;game:string;amount:string;returnsAmount:string;createdAt:string}>;daily:Array<{day:string;wagered:string;rounds:string}>;rewards:{currentLevel:number;nextLevel:{level:number;remaining:string;progress:number}|null;availableReward:string;totalClaimed:string;claimedCount:number;milestones:Array<{id:string;level:number;reward:string;claimable:boolean;claimed:boolean}>}|null;wagering:{overall:WagerProgress;ordinary:WagerProgress;tips:WagerProgress&{received:string;multiplier:string;qualifyingGames:string[]};bonus:(WagerProgress&{code:string;bonus:string;deposit:string;multiplier:string})|null;minWithdrawal:string;canRequestWithdrawal:boolean}};
export const accountMoney=(v:string|number)=>Number(v).toLocaleString('en-US',{style:'currency',currency:'USD'});
export const gameNames:Record<string,string>={case:'Cases',battle:'Battles',mines:'Mines',keno:'Keno',roulette:'Roulette',coinflip:'Coinflip',jackpot:'Jackpot'};
export function accountError(e:unknown){const code=(e as {response?:{data?:{error?:string};status?:number}})?.response?.data?.error,status=(e as {response?:{status?:number}})?.response?.status;return ({USERNAME_TAKEN:'That username is already taken.',INVALID_USERNAME:'Use 3–20 letters, numbers or underscores. Staff names are reserved.',INVALID_BIRTHDAY:'Enter a valid birth date that is not in the future.',INVALID_PROFILE_FIELD:'Check your profile fields and their lengths.',ACCOUNT_RESTRICTED:'Profile changes are restricted for this account.',SLOW_DOWN:'Please wait a moment before trying again.'} as Record<string,string>)[code||'']||(status===404?'The account backend needs updating. Restart using the latest RUN-LOCAL.ps1.':status===401?'Please log in again.':'Account information could not be loaded or saved. Please try again.');}
const Context=createContext<{data:AccountOverview|null;loading:boolean;error:string;refresh:()=>Promise<void>}>({data:null,loading:true,error:'',refresh:async()=>{}});
export const useAccountData=()=>useContext(Context);
export function AccountDataProvider({children}:{children:ReactNode}){
 const {token,user,isAuthenticated,hasHydrated}=useAuthStore(),pathname=usePathname();
 const [data,setData]=useState<AccountOverview|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const epoch=useRef(0),controller=useRef<AbortController|null>(null),userId=user?.id;
 const refresh=useCallback(async()=>{
  if(!token||!userId||!isAuthenticated||!hasHydrated)return;
  controller.current?.abort();const current=++epoch.current,request=new AbortController();controller.current=request;
  const expected=token,id=String(userId),balanceAtStart=useAuthStore.getState().user?.walletBalance;
  setLoading(true);setError('');
  try{const res=await apiClient.get<AccountOverview>('/user/account/dashboard',{signal:request.signal,headers:{Authorization:expected}});if(res.data.version!=='galaxy-account-v1'||String(res.data.profile.id)!==id)throw Error('Account version mismatch');
   const store=useAuthStore.getState();if(current!==epoch.current||store.token!==expected||String(store.user?.id)!==id)return;
   setData(res.data);store.updateUser({username:res.data.profile.username,name:res.data.profile.username,email:res.data.profile.email});
   if(store.user?.walletBalance===balanceAtStart&&Number.isFinite(Number(res.data.balance)))store.updateUser({balance:Number(res.data.balance),walletBalance:res.data.balance});
  }catch(e){if(!request.signal.aborted&&current===epoch.current)setError(accountError(e));}
  finally{if(current===epoch.current)setLoading(false);}
 },[token,userId,isAuthenticated,hasHydrated]);
 useEffect(()=>{setData(null);setError('');void refresh();const focus=()=>{if(document.visibilityState==='visible')void refresh();};const updated=()=>void refresh();document.addEventListener('visibilitychange',focus);window.addEventListener('galaxybets:account-updated',updated);return()=>{epoch.current++;controller.current?.abort();document.removeEventListener('visibilitychange',focus);window.removeEventListener('galaxybets:account-updated',updated);};},[refresh,pathname]);
 return <Context.Provider value={{data:data&&String(data.profile.id)===String(userId)?data:null,loading,error,refresh}}>{children}</Context.Provider>;
}
