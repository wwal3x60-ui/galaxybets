import { apiClient } from "./client";

export type EventType = "daily-raffle" | "weekly-race" | "monthly-race";

export interface EventWinner {
  id: string;
  rank: number;
  name: string;
  avatar: string;
  tickets: number;
  reward: string;
}

export interface EventData {
  id: string;
  type: EventType;
  title: string; // e.g., "Daily Raffle #120"
  prizePool: string; // e.g., "$2000"
  timeRemaining: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
  currentWinner?: {
    name: string;
    avatar: string;
    tickets: number;
  };
  description: string;
  winners: EventWinner[];
  totalWinners: number;
}

/**
 * Get event data by type
 */
export async function getEventData(type: EventType): Promise<EventData> {
  try {
    const response = await apiClient.get<{ success: boolean; data: EventData }>(`/events/${type}`);
    if (!response.data?.success || !response.data?.data) {
      throw new Error("Invalid events response");
    }
    return response.data.data;
  } catch (error: unknown) {
    console.error("Error fetching event data:", error);
    throw new Error("Failed to fetch event data. Please try again.");
  }
}
