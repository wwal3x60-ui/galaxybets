import MidnightShell from "./MidnightShell";
import SiteSurface from "./SiteSurface";
import CommunityShell from '@/components/community/CommunityShell';
import {Footer} from './Footer';
export default function Layout({children}:{children:React.ReactNode}){return <MidnightShell><CommunityShell><SiteSurface>{children}</SiteSurface></CommunityShell><Footer/></MidnightShell>}
