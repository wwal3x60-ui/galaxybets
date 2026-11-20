import type {ReactNode} from 'react';
import HouseGamePaused from '@/components/games/HouseGamePaused';
export default function Layout({children}:{children:ReactNode}){return <HouseGamePaused name="Keno">{children}</HouseGamePaused>;}
