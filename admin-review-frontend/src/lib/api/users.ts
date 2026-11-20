import { apiClient } from "./client";
import { type User } from "@/store/auth.store";

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
  birthday?: string; // ISO date string
  address?: string;
  addressAlt?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}

function unwrap<T>(res: any): T {
  // Backend shape: { success: true, data: ... }
  if (res?.data?.success && "data" in res.data) return res.data.data as T;
  // Fallback: direct payload
  return res?.data as T;
}

/**
 * Old backend GET /user returns:
 * { id, role, username, balance, xp, anon, notifications, rewards }
 * Fields it does not have get safe defaults.
 */
function mapBackendUserToFrontendUser(u: any): User {
  const name = u?.username ?? u?.name ?? "User";
  const xp = Number(u?.xp ?? 0) || 0;

  return {
    id: String(u.id),
    email: u.email ?? "",
    username: u.username ?? name,
    firstName: u.firstName ?? null,
    lastName: u.lastName ?? null,
    referralCode: u.referralCode ?? "",
    referredBy: u.referredBy ?? null,
    avatar: u.avatar ?? "/assets/avatar/avatar (1).png",
    birthday: u.birthday ?? null,
    address: u.address ?? null,
    addressAlt: u.addressAlt ?? null,
    city: u.city ?? null,
    state: u.state ?? null,
    country: u.country ?? null,
    phone: u.phone ?? null,
    name,
    balance: Number(u.balance ?? 0) || 0,
    totalExperience: xp,
    level: u.level ?? 1,
    levelProgress: u.levelProgress ?? 0,
  };
}

/**
 * Get current user profile.
 * Old backend route is GET /user (not /users/me).
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await apiClient.get("/user");
    const raw = unwrap<any>(response);
    const user = raw?.user ?? raw;
    if (!user || typeof user !== "object" || user.id == null) return null;
    return mapBackendUserToFrontendUser(user);
  } catch (error: unknown) {
    console.warn("Could not load current user:", error);
    return null;
  }
}

/**
 * Update user profile
 * (the old backend has no profile-edit route yet)
 */
export async function updateProfile(input: UpdateProfileInput): Promise<User> {
  try {
    const response = await apiClient.patch("/users/me", input);
    const user = unwrap<any>(response);
    return mapBackendUserToFrontendUser(user);
  } catch (error: any) {
    console.error("Error updating profile:", error);
    const message = error.response?.data?.message || error.message || "Failed to update profile";
    throw new Error(message);
  }
}
