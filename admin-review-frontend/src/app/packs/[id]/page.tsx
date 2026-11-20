import {redirect} from 'next/navigation';
export default async function LegacyPack({params}:{params:Promise<{id:string}>}){const {id}=await params;redirect(`/cases/${encodeURIComponent(id)}`);}
