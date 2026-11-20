import { apiClient } from "./client";
import { getPacks } from "./packs";

export interface PackImage {
  id: string;
  image: string;
}

export interface PackItemOption {
  id: string;
  image: string;
  name: string;
  price: string;
}

export interface CreatePackData {
  name: string;
  commission: number; // 0.5 to 3
  imageUrl: string;
  computedPackPrice: number;
  items: Array<{
    itemId: string;
    dropChance: number; // percentage
  }>;
}

/**
 * Read existing case images through the verified /cases adapter.
 * This backend does not provide /pack-thumbnails.
 */
export async function getPackImages(): Promise<PackImage[]> {
  try {
    const { packs } = await getPacks({ limit: 200 });
    const seen = new Set<string>();
    return packs.filter((pack) => {
      if (!pack.image || seen.has(pack.image)) return false;
      seen.add(pack.image);
      return true;
    }).map((pack) => ({ id: String(pack.id), image: pack.image }));
  } catch (error: unknown) {
    console.warn("Could not load existing case images:", error);
    return [];
  }
}

/**
 * Get available pack items for selection
 */
export async function getPackItemOptions(filters?: {
  search?: string;
  maxPrice?: number;
}): Promise<PackItemOption[]> {
  try {
    const res = await apiClient.get("/items", {
      params: {
        limit: 200,
        offset: 0,
        search: filters?.search || undefined,
        maxPrice: filters?.maxPrice,
      },
    });

    const templates: Array<{
      id: string;
      name: string;
      imageUrl: string | null;
      value: string | number;
    }> = res.data?.items ?? [];

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      image: t.imageUrl?.startsWith("/") && !t.imageUrl.startsWith("/api/v1/")
        ? `/api/v1${t.imageUrl}` : t.imageUrl ?? "/assets/images/placeholder.png",
      price: typeof t.value === "string" ? t.value : String(t.value),
    }));
  } catch (error: unknown) {
    console.warn("Could not load pack item options:", error);
    return [];
  }
}

/**
 * Create a new pack
 */
export async function createPack(data: CreatePackData): Promise<{ id: string }> {
  try {
    const res = await apiClient.post("/packs/create", {
      name: data.name,
      imageUrl: data.imageUrl,
      commission: data.commission,
      computedPackPrice: data.computedPackPrice,
      items: data.items,
    });

    const packId: string | undefined = res.data?.data?.pack?.id;
    if (!packId) throw new Error("Pack created but response missing pack.id");
    return { id: packId };
  } catch (error: unknown) {
    console.error("Error creating pack:", error);
    throw error;
  }
}
