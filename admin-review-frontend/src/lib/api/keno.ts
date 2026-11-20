import {apiClient} from './client';
export type KenoMode='easy'|'medium'|'hard';
export interface KenoConfig{minBet:string;maxBet:string;maxMultiplier:number;targetReturn:number|null;returns?:Record<KenoMode,number[]>;payoutVersion?:string;tables:Record<KenoMode,number[][]>}
export interface KenoResult{id:string;picks:number[];drawn:number[];difficulty:KenoMode;hits:number;multiplier:number;payout:string;amount:string;balance:string;nonce:number;clientSeed:string;serverSeedHash:string;algorithm:string;fractionalCarryUSD:string}
export async function kenoConfig(){return(await apiClient.get('/keno/config')).data as KenoConfig;}
export async function playKeno(body:{picks:number[];difficulty:KenoMode;amount:string;requestId:string}){return(await apiClient.post('/keno/play',body)).data as KenoResult;}
