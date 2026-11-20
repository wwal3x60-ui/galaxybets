"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationItems, gameItems } from "@/lib/constants/navigation";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils/cn";
import { GameLinks } from "./GameLinks";
import styles from "./Navigation.module.css";

export function Navigation({className}: {className?:string}) {
  const pathname = usePathname();
  const [expanded,setExpanded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const focusFirst = useRef(false);
  const panelId = useId();
  const gameActive = pathname === "/games" || gameItems.some(game=>pathname===game.href||pathname.startsWith(game.href+"/"));
  useEffect(()=>setExpanded(false),[pathname]);
  useEffect(()=>{
    if(!expanded)return;
    if(focusFirst.current){root.current?.querySelector<HTMLAnchorElement>("a")?.focus();focusFirst.current=false;}
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setExpanded(false);};
    const escape=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){setExpanded(false);trigger.current?.focus();}
    };
    document.addEventListener("pointerdown",outside);
    document.addEventListener("keydown",escape);
    return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
  },[expanded]);
  return <nav aria-label="Main navigation" className={cn(styles.navigation,className)}>
    <div className={styles.games} ref={root} onBlur={event=>{
      if(event.relatedTarget&&!event.currentTarget.contains(event.relatedTarget as Node))setExpanded(false);
    }}>
      <button ref={trigger} type="button" aria-expanded={expanded} aria-controls={panelId}
        className={`${styles.trigger} ${gameActive||expanded?styles.selected:""}`}
        onClick={()=>setExpanded(value=>!value)}
        onKeyDown={event=>{
          if(event.key==="ArrowDown"){event.preventDefault();focusFirst.current=true;if(expanded)root.current?.querySelector<HTMLAnchorElement>("a")?.focus();else setExpanded(true);}
        }}>
        <svg className={styles.gamesSymbol} viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="3" width="5" height="5" rx="1.2"/><rect x="12" y="3" width="5" height="5" rx="1.2"/><rect x="3" y="12" width="5" height="5" rx="1.2"/><rect x="12" y="12" width="5" height="5" rx="1.2"/></svg>
        Games
        <svg viewBox="0 0 16 16" fill="none" className={`${styles.chevron} ${expanded?styles.rotated:""}`} aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
      </button>
      {expanded&&<div id={panelId} className={styles.dropdown} onKeyDown={event=>{
        const links=Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
        const index=links.indexOf(document.activeElement as HTMLAnchorElement);
        if(!["ArrowDown","ArrowUp","Home","End"].includes(event.key))return;
        event.preventDefault();
        const next=event.key==="Home"?0:event.key==="End"?links.length-1:(index+(event.key==="ArrowDown"?1:-1)+links.length)%links.length;
        links[next]?.focus();
      }}>
        <span className={styles.dropdownLabel}>Games</span>
        <GameLinks pathname={pathname} onNavigate={()=>setExpanded(false)}/>
      </div>}
    </div>
    {navigationItems.map(item=>{
      const active=pathname===item.href||pathname.startsWith(item.href+"/");
      return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={`${styles.navLink} ${active?styles.selected:""}`}>
        {item.label}{item.icon&&<Icon name={item.icon} isActive={active}/>}
      </Link>;
    })}
  </nav>;
}
