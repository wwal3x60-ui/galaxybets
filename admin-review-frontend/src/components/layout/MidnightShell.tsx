"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useModalStore } from "@/store/modal.store";
import { useCommunityStore } from "@/store/community.store";
import UiGlyph from "@/components/ui/UiGlyph";
import { Logo } from "./Logo";
import BalanceCapsule from "./BalanceCapsule";
import { UserMenu } from "./UserMenu";
import GameSoundControl from "@/components/ui/GameSoundControl";

type IconName = 'home'|'packs'|'battles'|'games'|'mines'|'keno'|'roulette'|'jackpot'|'coinflip'|'account'|'gift'|'shield'|'support'|'search'|'menu'|'cart'|'arrow'|'slots'|'wallet'|'x';
export function CircuitIcon({name,size=18}:{name:IconName;size?:number}) { return <UiGlyph name={name} size={size}/>; }
const mainLinks = [
  {href:'/cases',label:'Cases',icon:'packs'}, {href:'/battles',label:'Battles',icon:'battles'},
  {href:'/games',label:'Games',icon:'games'}, {href:'/slots',label:'Slots',icon:'slots'},
  {href:'/rewards',label:'Rewards',icon:'gift'},
] as const;
const originals = [['/mines','Mines','mines'],['/roulette','Roulette','roulette'],['/coinflip','Coinflip','coinflip'],['/jackpot','Jackpot','jackpot']] as const;

export default function CrimsonShell({children}:{children:ReactNode}) {
  const path=usePathname(), {user,isAuthenticated}=useAuthStore();
  const open=useModalStore(s=>s.open),show=useCommunityStore(s=>s.show);
  const [menu,setMenu]=useState(false),[drawerOpen,setDrawerOpen]=useState(false);
  const drawer=useRef<HTMLDialogElement>(null);
  const active=(href:string)=>path===href||path.startsWith(href+'/');
  useEffect(()=>{drawer.current?.close();setMenu(false);},[path]);
  useEffect(()=>{if(!drawerOpen)return; const before=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=before;};},[drawerOpen]);
  useEffect(()=>{const query=window.matchMedia('(min-width: 1100px)');const close=()=>{if(query.matches)drawer.current?.close();};query.addEventListener('change',close);return()=>query.removeEventListener('change',close);},[]);
  const openDrawer=()=>{if(drawer.current&&!drawer.current.open){drawer.current.showModal();setDrawerOpen(true);}};
  const wallet=()=>isAuthenticated?show('wallet'):open('login');
  const closeDrawer=()=>drawer.current?.close();
  const drawerLink=(href:string,label:string,icon:IconName)=><Link key={href} href={href} onClick={closeDrawer} className={active(href)?'isActive':''} aria-current={active(href)?'page':undefined}><CircuitIcon name={icon}/>{label}</Link>;
  return <div className="galaxy crimson" data-ui-theme="crimson-arena-v1">
    <a className="mcSkip" href="#mc-content">Skip to content</a>
    <header className="crHeader">
      <button className="crIconButton crMobileMenu" onClick={openDrawer} aria-label="Open navigation" aria-controls="cr-drawer" aria-expanded={drawerOpen}><CircuitIcon name="menu"/></button>
      <Logo/>
      <nav className="crTopNav" aria-label="Main navigation">{mainLinks.map(item=><Link key={item.href} href={item.href} className={active(item.href)?'isActive':''} aria-current={active(item.href)?'page':undefined}>{item.label}</Link>)}</nav>
      <div className="crHeaderActions">
        {isAuthenticated&&user?<>
          <button className="crIconButton crCart" onClick={()=>open('cart')} aria-label={`Open inventory, ${user.cartCount||0} items`} title="Inventory"><CircuitIcon name="cart"/><span>{user.cartCount||0}</span></button>
          <BalanceCapsule compact balance={user.walletBalance??user.balance} onWallet={wallet} onDeposit={()=>open('deposit')}/>
          <div className="crProfile"><button className="crIconButton" data-account-toggle="true" onClick={()=>setMenu(v=>!v)} aria-expanded={menu} aria-label="Account menu"><CircuitIcon name="account"/></button><UserMenu isOpen={menu} onClose={()=>setMenu(false)} onDeposit={()=>open('deposit')}/></div>
        </>:<><button className="crButton crButtonOutline crLogin" onClick={()=>open('login')}>Log in</button><button className="crButton crButtonPrimary" onClick={()=>open('signup')}>Sign up</button></>}
      </div>
    </header>
    <aside className="crRail" aria-label="Quick navigation"><Link className="crRailMark" href="/" aria-label="GalaxyBets home"><span className="crSlashes" aria-hidden="true">///</span></Link><nav>
      {[{href:'/',label:'Home',icon:'home' as const},...mainLinks].map(item=><Link key={item.href} href={item.href} title={item.label} aria-label={item.label} aria-current={path==='/'&&item.href==='/'||item.href!=='/'&&active(item.href)?'page':undefined} className={(item.href==='/'?path==='/':active(item.href))?'isActive':''}><CircuitIcon name={item.icon} size={22}/><span>{item.label}</span></Link>)}
    </nav><div className="crRailBottom"><Link href="/affiliates" aria-label="Affiliates" title="Affiliates"><CircuitIcon name="gift"/></Link><Link href="/support" aria-label="Support" title="Support"><CircuitIcon name="support"/></Link><GameSoundControl/></div></aside>
    <dialog id="cr-drawer" ref={drawer} className="crDrawer" aria-label="All navigation" onClose={()=>setDrawerOpen(false)} onClick={event=>{if(event.target===event.currentTarget){const box=event.currentTarget.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDrawer();}}}>
      <header><Logo/><button className="crIconButton" onClick={closeDrawer} aria-label="Close navigation"><CircuitIcon name="x"/></button></header>
      <nav>{drawerLink('/','Home','home')}{mainLinks.map(item=>drawerLink(item.href,item.label,item.icon))}<p>Originals</p>{originals.map(([href,label,icon])=>drawerLink(href,label,icon))}<p>Your Galaxy</p>{drawerLink('/account/dashboard','My account','account')}{drawerLink('/events','Events','gift')}{drawerLink('/affiliates','Affiliates','gift')}{drawerLink('/fairness','Fairness','shield')}{drawerLink('/support','Support','support')}{user?.role==='STREAMER'&&drawerLink('/streamer','Creator dashboard','games')}{['ADMIN','OWNER','DEV'].includes(user?.role||'')&&drawerLink('/admin','Administration','shield')}</nav>
      <p className="crMuted">18+ · Set limits. Play responsibly.</p>
    </dialog>
    <div className="mcWorkspace crWorkspace" id="mc-content" tabIndex={-1}>{children}</div>
    <nav className="crMobileNav" aria-label="Mobile navigation">
      <Link href="/" aria-current={path==='/'?'page':undefined}><CircuitIcon name="home"/><span>Home</span></Link>
      <Link href="/cases" aria-current={active('/cases')?'page':undefined}><CircuitIcon name="packs"/><span>Cases</span></Link>
      <Link href="/battles" aria-current={active('/battles')?'page':undefined}><CircuitIcon name="battles"/><span>Battles</span></Link>
      <Link href="/games" aria-current={active('/games')||originals.some(([href])=>active(href))?'page':undefined}><CircuitIcon name="games"/><span>Games</span></Link>
      <button onClick={openDrawer} aria-expanded={drawerOpen} aria-controls="cr-drawer"><CircuitIcon name="menu"/><span>Menu</span></button>
    </nav>
  </div>;
}
