import {caseBySlug} from '@/lib/cases/collection';
import CasePreview from '@/components/crimson/CasePreview';
import LiveCasePage from '@/components/crimson/LiveCasePage';
export async function generateMetadata({params}:{params:Promise<{id:string}>}) {const {id}=await params;const item=caseBySlug(id);return {title:item?`${item.name} Case`:'Case opening'};}
export default async function CasePage({params}:{params:Promise<{id:string}>}){const {id}=await params;const item=caseBySlug(id);return item?<CasePreview key={item.slug} item={item}/>:<LiveCasePage/>;}
