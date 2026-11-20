import Link from 'next/link';
export function Logo({className=''}:{className?:string}) {
 return <Link href="/" aria-label="GalaxyBets home" className={`crLogo ${className}`} data-brand="crimson-arena"><span>GALAXY<span>BETS</span></span></Link>;
}
