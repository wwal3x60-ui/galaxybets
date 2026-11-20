"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import AccountIcon from './AccountIcon';
import styles from './AccountSystem.module.css';
const groups=[
 {label:'PLAYER CENTRE',items:[['/account/dashboard','Dashboard','dashboard'],['/account/profile','My profile','user'],['/rewards','Level rewards','gift']]},
 {label:'WALLET & HISTORY',items:[['/account/deposits','Deposits','wallet'],['/account/withdrawals','Withdrawals','arrow'],['/account/sales','Item sales','coin'],['/account/battle-history','Battle history','history'],['/account/case-history','Case history','packs'],['/account/upgrader-history','Upgrader history','history']]},
 {label:'AFFILIATES',items:[['/account/commission','Commission','coin'],['/account/affiliates','Affiliates','people']]},
 {label:'SETTINGS',items:[['/account/settings/security','Security','shield'],['/account/settings/fairness','Fairness','check']]}
];
export function AccountSidebar(){
 const path=usePathname();
 return <nav className={styles.sidebar} aria-label="Account navigation">{groups.map(group=><div className={styles.navGroup} key={group.label}><p>{group.label}</p>{group.items.map(([href,label,icon])=><Link key={href} href={href} aria-current={path===href?'page':undefined}><AccountIcon name={icon}/><span>{label}</span>{path===href&&<i/>}</Link>)}</div>)}<a className={styles.supportLink} href="mailto:support@galaxybets.casino"><AccountIcon name="shield"/>Need help?<AccountIcon name="arrow"/></a></nav>;
}
