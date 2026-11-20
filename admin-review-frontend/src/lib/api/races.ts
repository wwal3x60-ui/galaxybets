import { apiClient } from './client';
export type RaceType = 'weekly' | 'monthly';
export interface RacePlayer {
  id: string;
  username: string;
  position: number;
  wagered: string;
  reward: string;
}
export interface RaceData {
  id: string;
  type: RaceType;
  title: string;
  roundNumber: number;
  startsAt: string;
  endsAt: string;
  serverNow: string;
  status: 'active' | 'catching_up';
  prizePool: string;
  prizes: string[];
  users: RacePlayer[];
  previousWinners: (RacePlayer & { roundNumber: number })[];
}
export interface RaceSnapshot { data: RaceData; receivedAt: number; remainingAtReceipt: number; }
export async function getRace(type: RaceType, signal?: AbortSignal): Promise<RaceSnapshot> {
  const startedAt = performance.now();
  const response = await apiClient.get<RaceData>(`/leaderboard/${type}`, {signal});
  const receivedAt = performance.now();
  const data = response.data;
  const remaining = Date.parse(data.endsAt) - Date.parse(data.serverNow);
  if (data.type !== type || !Array.isArray(data.users) || !Array.isArray(data.prizes) || !Number.isFinite(remaining)) {
    throw new Error('The race response was invalid. Please try again.');
  }
  // A monotonic elapsed clock keeps the deadline stable if the computer clock
  // changes. Polling resynchronizes it with the persisted server deadline.
  return {data, receivedAt, remainingAtReceipt: Math.max(0, remaining - (receivedAt - startedAt) / 2)};
}
