'use client';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
export function SlotsEntry({className,onNavigate}:{className?:string;onNavigate?:()=>void}) {
 const role=useAuthStore(s=>s.user?.role);
 if(String(role).toUpperCase()!=='ADMIN')return null;
 return <li><Link href="/slots" className={className} onClick={onNavigate}>Slots <span style={{fontSize:10,opacity:.65}}>ADMIN TEST</span></Link></li>;
}
