import {create} from 'zustand';
type View='chat'|'profile'|'tip'|'wallet'|null;
export const useCommunityStore=create<{view:View;username:string;show:(view:View,username?:string)=>void;close:()=>void}>(set=>({view:null,username:'',show:(view,username='')=>set({view,username}),close:()=>set({view:null})}));
