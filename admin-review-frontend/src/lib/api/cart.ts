import { cleanedDropImage } from "@/lib/utils/drop-cutouts";
import { apiClient } from "./client";
import { useAuthStore } from "@/store/auth.store";

export interface CartItem {
  id: string;
  name: string;
  price: string; // numeric string (no $)
  image: string;
  itemType?: "ITEM" | "VOUCHER";
  status?: "AVAILABLE" | "SOLD" | "PENDING_FULFILLMENT" | "SHIPPED" | "CANCELLED";
  isSelected?: boolean;
}

type CartStatus = "AVAILABLE" | "SOLD" | "PENDING_FULFILLMENT" | "SHIPPED" | "CANCELLED";

/** Full web addresses stay as they are; backend paths go through the /api/v1 rewrite */
function resolveImage(src: unknown): string {
  const value = cleanedDropImage(src);
  if (!value) return "/img/logo.png";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  if (value.startsWith("/api/v1/")) return value;
  return `/api/v1${value.startsWith("/") ? "" : "/"}${value}`;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getErrorMessage(error: any, fallback: string): string {
  const code = error?.response?.data?.error;
  const messages: Record<string, string> = {
    ITEMS_NOT_AVAILABLE: "Some of these items were already sold.",
    INVALID_IDS: "Please select at least one item.",
    SLOW_DOWN: "Please slow down and try again.",
    UNAUTHORIZED: "Please log in first.",
  };
  if (typeof code === "string" && messages[code]) return messages[code];
  if (error?.response?.status === 401) return messages.UNAUTHORIZED;
  return fallback;
}

/**
 * Items won from cases wait in the inventory (the cart) until sold.
 * Old backend: GET /user/inventory (added for this project).
 */
export async function getCartItems(status: CartStatus = "AVAILABLE"): Promise<CartItem[]> {
  // Only AVAILABLE and SOLD exist on the backend
  if (status !== "AVAILABLE" && status !== "SOLD") return [];
  // Not logged in -> nothing to load (avoids a pointless 401)
  if (!useAuthStore.getState().token) return [];

  try {
    const res = await apiClient.get("/user/inventory", { params: { status } });
    const list: any[] = Array.isArray(res?.data) ? res.data : [];
    return list.map((item) => ({
      id: String(item.id),
      name: item.name ?? "Item",
      price: String(toNumber(item.price)),
      image: resolveImage(item.img),
      itemType: "ITEM" as const,
      status: item.status === "SOLD" ? ("SOLD" as const) : ("AVAILABLE" as const),
    }));
  } catch (error) {
    console.warn("Could not load cart items:", error);
    return [];
  }
}

/**
 * Sell items from the cart for their value.
 * Old backend: POST /user/inventory/sell { ids } -> { success, totalPrice, balance }
 */
export async function sellCartItems(
  itemIds: string[]
): Promise<{ success: boolean; totalPrice: string }> {
  try {
    const ids = itemIds.map((id) => Number(id));
    const res = await apiClient.post("/user/inventory/sell", { ids });
    const data = res?.data ?? {};

    const newBalance = Number(data.balance);
    if (Number.isFinite(newBalance)) {
      useAuthStore.getState().updateUser({
        balance: newBalance,
        walletBalance: String(newBalance),
      });
    }

    return { success: Boolean(data.success), totalPrice: String(toNumber(data.totalPrice)) };
  } catch (error: any) {
    console.warn("Error selling items:", error);
    throw new Error(getErrorMessage(error, "Failed to sell items. Please try again."));
  }
}
