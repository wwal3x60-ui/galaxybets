import Link from 'next/link';
import {Logo} from './Logo';
export function Footer(){
 return <footer className="mcFooter">
  <div><Logo className="gxFooterLogo"/><span className="mcFooterNote">Cases. Battles. Originals.</span></div>
  <nav aria-label="Footer">
   <Link href="/review">Review collection</Link><Link href="/fairness">Fairness</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link>
   <a href="https://discord.gg/33QzVUuap" target="_blank" rel="noopener noreferrer">Discord</a>
   <a href="https://x.com/GalaxyBets_" target="_blank" rel="noopener noreferrer" aria-label="GalaxyBets on X" className="inline-flex items-center gap-2"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l7.2-8.3L1.8 2h6.5l4.5 6.8L18.9 2ZM17.8 20h1.7L7.3 4H5.5l12.3 16Z"/></svg>X</a>
   <a href="mailto:support@galaxybets.casino" aria-label="Email support at support@galaxybets.casino">Support</a>
  </nav>
  <p><b>18+</b> Play responsibly. <span>© {new Date().getFullYear()} GalaxyBets</span></p>
 </footer>;
}
