"use client";
import {useId} from 'react';

/** Original Galaxy Passport crest; no third-party rank artwork. */
export default function LevelBadge({level,className}:{level:number;className?:string}){
 const id=useId().replace(/:/g,''),tier=Math.min(5,Math.max(1,Math.ceil(level/4)));
 return <svg className={className} viewBox="0 0 200 220" fill="none" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={`${id}-silver`} x1="35" y1="25" x2="175" y2="190" gradientUnits="userSpaceOnUse"><stop stopColor="#fff5ff"/><stop offset=".23" stopColor="#b1b1b6"/><stop offset=".43" stopColor="#f7e6ff"/><stop offset=".63" stopColor="#707075"/><stop offset=".83" stopColor="#e0e0e5"/><stop offset="1" stopColor="#949499"/></linearGradient>
   <linearGradient id={`${id}-violet`} x1="70" y1="30" x2="135" y2="175" gradientUnits="userSpaceOnUse"><stop stopColor="#eb808b"/><stop offset=".36" stopColor="#d83e4a"/><stop offset="1" stopColor="#27282c"/></linearGradient>
   <radialGradient id={`${id}-core`}><stop stopColor="#d83e4a"/><stop offset=".62" stopColor="#494a4e"/><stop offset="1" stopColor="#1a1b1f"/></radialGradient>
  </defs>
  <ellipse cx="100" cy="199" rx="59" ry="8" fill="#0f1013" opacity=".55"/>
  {[false,true].map(mirror=><g key={String(mirror)} transform={mirror?'translate(200 0) scale(-1 1)':undefined}>
   <path d="M80 184C32 165 24 111 45 64" stroke={`url(#${id}-silver)`} strokeWidth="3"/>
   {[0,1,2,3,4,5].map(i=><path key={i} d="M49 66C28 62 27 49 30 39C46 45 53 55 49 66Z" transform={`translate(${-i*.7} ${i*19}) rotate(${-i*12} 45 62)`} fill={`url(#${id}-silver)`} stroke="#f5f5f8" strokeOpacity=".28"/>)}
  </g>)}
  <path d={tier>=3?'M100 26 151 45 163 100 145 153 100 183 55 153 37 100 49 45Z':'M100 30 148 53 155 112 132 156 100 179 68 156 45 112 52 53Z'} fill={`url(#${id}-silver)`}/>
  <path d="M100 38 142 59 148 110 126 150 100 171 74 150 52 110 58 59Z" fill={`url(#${id}-violet)`} stroke="#ececf1" strokeWidth="1.5"/>
  <path d="M100 48 133 64 139 108 120 143 100 158 80 143 61 108 67 64Z" fill={`url(#${id}-core)`} stroke="#d3d3d8" strokeOpacity=".6"/>
  <path d="M100 8 112 28 100 47 88 28Z" fill={`url(#${id}-violet)`} stroke="#e8e8ed" strokeWidth="1.5"/><path d="m100 8 2 20-2 19-12-19Z" fill="#dcdce1" opacity=".45"/>
  {tier>=2&&<g fill={`url(#${id}-violet)`} stroke="#dadadf"><path d="m48 69-12 13 6 24 13-14Z"/><path d="m152 69 12 13-6 24-13-14Z"/></g>}
  {tier>=4&&<path d="m69 42-6-25 24 12L100 10l13 19 24-12-6 25" fill={`url(#${id}-silver)`} stroke="#efeff4"/>}
  <text x="100" y="85" textAnchor="middle" fill="#dbdbe0" fontFamily="inherit" fontSize="11" fontWeight="600" letterSpacing="3">{level>0?'LEVEL':'START'}</text>
  <text x="100" y="128" textAnchor="middle" fill="#fff2ff" fontFamily="inherit" fontSize={level>9?'39':'45'} fontWeight="750">{level>0?level:'✦'}</text>
  <path d="m88 145 12-5 12 5-12 5Z" fill="#eb808b"/>
  {tier===5&&<path d="m100 180 6 9 11 1-8 7 2 11-11-5-11 5 2-11-8-7 11-1Z" fill={`url(#${id}-silver)`}/>}
 </svg>;
}
