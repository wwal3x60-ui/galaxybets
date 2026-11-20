import { apiClient } from "./client";

export interface FairnessData {
  clientSeed: string | null;
  hasClientSeed: boolean;
}

/**
 * Get user's client seed for provably fair
 */
export async function getClientSeed(): Promise<FairnessData> {
  try {
    const response = await apiClient.get<{ success: boolean; data: { clientSeed: string | null; hasClientSeed: boolean } }>('/users/me/client-seed');
    
    if (!response.data.success) {
      throw new Error('Failed to fetch client seed');
    }

    return {
      clientSeed: response.data.data.clientSeed,
      hasClientSeed: response.data.data.hasClientSeed,
    };
  } catch (error: unknown) {
    console.error("Error fetching client seed:", error);
    return {
      clientSeed: null,
      hasClientSeed: false,
    };
  }
}

/**
 * Regenerate user's client seed
 */
export async function regenerateClientSeed(): Promise<string> {
  try {
    const response = await apiClient.post<{ success: boolean; data: { clientSeed: string; message: string } }>('/users/me/client-seed/regenerate');
    
    if (!response.data.success) {
      throw new Error('Failed to regenerate client seed');
    }

    return response.data.data.clientSeed;
  } catch (error: unknown) {
    console.error("Error regenerating client seed:", error);
    throw error;
  }
}
