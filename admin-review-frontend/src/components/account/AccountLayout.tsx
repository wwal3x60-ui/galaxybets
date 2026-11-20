"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useEffect,useState,type ReactNode} from 'react';
import {useAuthStore} from '@/store/auth.store';
import {useModalStore} from '@/store/modal.store';
import {AccountSidebar} from './AccountSidebar';
import {AccountDataProvider,useAccountData,accountMoney} from './AccountData';
import AccountIcon from './AccountIcon';
import LevelBadge from '@/components/rewards/LevelBadge';
import styles from './AccountSystem.module.css';

function AccountFrame({children}:{children:ReactNode}){
 const {user}=useAuthStore(),open=useModalStore(s=>s.open),{data}=useAccountData(),pathname=usePathname();
 const [avatarFailed,setAvatarFailed]=useState(false);useEffect(()=>setAvatarFailed(false),[user?.avatar]);
 const username=user?.username||user?.name||'Player',reward=data?.rewards;
 const view=pathname==='/account/dashboard'?'dashboard':pathname==='/account/profile'?'profile':pathname==='/account/settings/security'?'security':'legacy';
 return <section className={styles.account} data-account-system="galaxy-account-v1">
  <header className={styles.memberHeader}>
   <div className={styles.member}><div className={styles.avatar}>{user?.avatar&&!avatarFailed?<img src={user.avatar} alt="" onError={()=>setAvatarFailed(true)}/>:<span>{Array.from(username)[0]?.toUpperCase()}</span>}</div><div><span className={styles.kicker}>YOUR GALAXY ACCOUNT</span><h2>{username}</h2><span className={styles.memberSince}>{data?`Member since ${new Date(data.profile.createdAt).toLocaleDateString(undefined,{month:'short',year:'numeric'})}`:'Your player centre'}</span></div></div>
   <Link className={styles.headerLevel} href="/rewards"><LevelBadge level={reward?.currentLevel||0}/><div><span>GALAXY PASSPORT</span><strong>{reward?reward.currentLevel>0?`Level ${reward.currentLevel}`:'Getting started':'View level rewards'}</strong></div><AccountIcon name="arrow"/></Link>
   <div className={styles.headerWallet}><div><span>AVAILABLE BALANCE · USD</span><strong>{accountMoney(user?.walletBalance??user?.balance??0)}</strong></div><div><button type="button" className={styles.primary} onClick={()=>open('deposit')}>+ Deposit</button><button type="button" className={styles.secondary} onClick={()=>open('withdraw')}>Withdraw</button></div></div>
  </header>
  <div className={styles.accountBody}><AccountSidebar/><main className={styles.main} data-view={view} data-account-content>{children}</main></div>
 </section>;
}
export function AccountLayout({children}:{children:ReactNode}){
 const {user,hasHydrated,isAuthenticated,token}=useAuthStore(),open=useModalStore(s=>s.open);
 if(!hasHydrated)return <section className={styles.login} role="status">Loading your account…</section>;
 if(!user||!isAuthenticated||!token)return <section className={styles.login}><AccountIcon name="user"/><h1>Your player centre</h1><p>Log in to view your Dashboard, profile and account progress.</p><button type="button" className={styles.primary} onClick={()=>open('login')}>Log in</button></section>;
 return <AccountDataProvider><AccountFrame>{children}</AccountFrame></AccountDataProvider>;
}
