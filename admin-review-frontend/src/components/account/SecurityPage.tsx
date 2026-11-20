"use client";
import {useState} from 'react';
import {useAuthStore} from '@/store/auth.store';
import {apiClient} from '@/lib/api/client';
import {useAccountData} from './AccountData';
import AccountIcon from './AccountIcon';
import styles from './AccountSystem.module.css';
export function SecurityPage(){
 const {data,loading,error,refresh}=useAccountData(),[busy,setBusy]=useState(false);
 const signOut=async()=>{if(busy)return;const expected=useAuthStore.getState().token;if(!expected)return;setBusy(true);try{await apiClient.post('/auth/logout',{}, {headers:{Authorization:expected}});}catch{}finally{if(useAuthStore.getState().token===expected)useAuthStore.getState().logout();setBusy(false);}};
 return <section className={styles.profilePage}><header className={styles.pageTitle}><div><span className={styles.kicker}>ACCOUNT SETTINGS</span><h1>Security</h1><p>Your account information and sign-in controls.</p></div><AccountIcon name="shield"/></header>{error&&<div className={styles.error} role="alert"><p>{error}</p><button type="button" className={styles.secondary} disabled={loading} onClick={()=>void refresh()}>Try again</button></div>}
  {data?<div className={styles.identityGrid}><article className={styles.panel}><div className={styles.panelHeading}><h2>Account email</h2><AccountIcon name="shield"/></div><strong className={styles.securityEmail}>{data.profile.email}</strong><span className={data.profile.emailVerified?styles.goodChip:styles.statusChip}>{data.profile.emailVerified?'Email verified':'Email not verified'}</span><p className={styles.helpText}>Need to update your sign-in details? Contact support for help.</p><a className={styles.secondary} href="mailto:support@galaxybets.casino">Contact support<AccountIcon name="arrow"/></a></article><article className={styles.panel}><div className={styles.panelHeading}><h2>Sign-in settings</h2><AccountIcon name="user"/></div><dl className={styles.accountDetails}><div><dt>Two-factor configuration</dt><dd>{data.profile.twoFactorConfigured?'Configured':'Not configured'}</dd></div><div><dt>Current session</dt><dd>Signed in on this device</dd></div></dl><p className={styles.helpText}>Contact support to manage your sign-in protection.</p><button className={styles.secondary} type="button" disabled={busy} onClick={()=>void signOut()}>{busy?'Signing out…':'Sign out of this device'}</button></article></div>:<p className={styles.empty} role="status">{loading?'Loading account status…':'Account status is unavailable.'}</p>}
 </section>;
}
