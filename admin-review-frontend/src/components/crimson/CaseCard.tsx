import Image from 'next/image';
import Link from 'next/link';
import {caseImage,caseMoney,type ReviewCase} from '@/lib/cases/collection';
export default function CaseCard({item,priority=false}:{item:ReviewCase;priority?:boolean}) {
 return <Link href={`/cases/${item.slug}`} className="crCaseCard" style={{'--case-accent':item.color} as React.CSSProperties}>
  <div className="crCaseImage"><Image src={caseImage(item.slug)} alt={`${item.name} case artwork`} width={640} height={512} sizes="(max-width:600px) 46vw,(max-width:1100px) 30vw,18vw" priority={priority}/><span className="crCasePreview">Preview</span><span className="crCaseView">View case</span></div>
  <div className="crCaseInfo"><small>{item.category} collection</small><h3>{item.name}</h3><div><strong>{caseMoney(item.price)}</strong><span>Concept price</span></div></div>
 </Link>;
}
