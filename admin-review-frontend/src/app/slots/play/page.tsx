import SlotsGamePlayer from '@/components/slots/SlotsGamePlayer';
export default async function Page({searchParams}:{searchParams:Promise<{game?:string|string[]}>}){
 const params=await searchParams;
 return <SlotsGamePlayer gameId={typeof params.game==='string'?params.game:''}/>;
}
