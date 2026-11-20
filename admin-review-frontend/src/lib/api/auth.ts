import { apiClient } from "./client";
import { type User } from "@/store/auth.store";

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupCredentials {
  email: string;
  password: string;
  agreeToTerms: boolean;
  username?: string;
  firstName?: string;
  lastName?: string;
  referredByCode?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

/**
 * Old backend GET /user returns { id, role, username, balance, xp, ... }.
 * Fields it does not have get safe defaults.
 */
function mapBackendUserToFrontendUser(u: any): User {
  const name = u?.username ?? u?.name ?? "User";
  const xp = Number(u?.xp ?? 0) || 0;

  return {
    id: String(u.id),
    role:String(u.role??"USER"),
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

function unwrap<T>(res: any): T {
  // Backend shape: { success: true, data: ... }
  if (res?.data?.success && "data" in res.data) return res.data.data as T;
  // Fallback: direct payload
  return res?.data as T;
}

/** Turns backend error codes into messages people can read */
function getErrorMessage(error: any, fallback: string): string {
  const messages: Record<string, string> = {
    INVALID_CREDENTIALS: "Incorrect email or password.",
    TOO_MANY_REQUESTS: "Too many attempts. Please try again later.",
    UNAUTHORIZED: "This account cannot log in.",
    USERNAME_TAKEN: "That username is already taken.",
    EMAIL_TAKEN: "An account with this email already exists.",
    INVALID_USERNAME: "Username must be 3-20 characters: letters, numbers and underscores only.",
    INVALID_EMAIL: "Please enter a valid email address.",
    INVALID_PASSWORD: "Password must be at least 10 characters and not a common password.",
    CONFIRM_18_REQUIRED: "You must confirm that you are 18 or older.",
  };

  const retryAfter = Number(error?.response?.data?.retryAfter);
  if (error?.response?.status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter < 60 ? `Too many attempts. Try again in ${Math.ceil(retryAfter)} seconds.` : `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`;
  }
  const code = error?.response?.data?.error;
  if (typeof code === "string" && messages[code]) return messages[code];
  if (error?.response?.status === 429) return messages.TOO_MANY_REQUESTS;
  if (error?.code === "ERR_NETWORK") return "Cannot reach the server. Is the backend running?";
  return fallback;
}

/** Loads the profile with an explicit token (used right after login/register) */
async function fetchProfile(token: string): Promise<User | null> {
  try {
    const response = await apiClient.get("/user", { headers: { Authorization: token } });
    const raw = unwrap<any>(response);
    const user = raw?.user ?? raw;
    if (!user || typeof user !== "object" || user.id == null) return null;
    return mapBackendUserToFrontendUser(user);
  } catch {
    return null;
  }
}

/** Builds the user + token result from the backend's login/register response */
async function buildSession(session: any, email: string): Promise<AuthResponse> {
  const token: string | undefined = session?.token;
  if (!token || session?.userId == null) throw new Error("Invalid response from server");

  const baseUser = mapBackendUserToFrontendUser({
    id: session.userId,
    username: session.username,
    email,
  });
  const profile = await fetchProfile(token);

  return {
    user: profile ? { ...profile, email } : baseUser,
    token,
  };
}

/**
 * Login user
 * Old backend: POST /auth/login -> { token, userId, username, expiresIn }
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  try {
    const email = credentials.email.trim().toLowerCase();
    const response = await apiClient.post("/auth/login", {
      email,
      password: credentials.password,
    });
    return await buildSession(unwrap<any>(response), email);
  } catch (error: unknown) {
    console.warn("Error logging in:", error);
    throw new Error(getErrorMessage(error, "Failed to login. Please try again."));
  }
}

/** Makes a valid backend username (3-20 chars, letters/numbers/underscore) */
function makeUsername(email: string, wanted?: string): string {
  let name = (wanted ?? email.split("@")[0] ?? "").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 20);
  if (name.length < 3) name = (name + "user").slice(0, 20);
  return name;
}

/**
 * Sign up new user
 * Old backend: POST /auth/register -> { token, userId, username, expiresIn }
 */
export async function signup(credentials: SignupCredentials): Promise<AuthResponse> {
  try {
    const email = credentials.email.trim().toLowerCase();
    const response = await apiClient.post("/auth/register", {
      email,
      username: makeUsername(email, credentials.username),
      password: credentials.password,
      confirm18: true,
    });
    return await buildSession(unwrap<any>(response), email);
  } catch (error: unknown) {
    console.warn("Error signing up:", error);
    throw new Error(getErrorMessage(error, "Failed to create account. Please try again."));
  }
}

/**
 * Logout user
 * Old backend: POST /auth/logout invalidates the current token.
 * Never throws, so the UI can always log out locally.
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post("/auth/logout");
  } catch (error: unknown) {
    console.warn("Error logging out:", error);
  }
}

export class GoogleAuthError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export async function googleChallenge(): Promise<string> {
  const response = await apiClient.post('/auth/google/challenge', {});
  const nonce = unwrap<{nonce:string}>(response)?.nonce;
  if (!nonce) throw new Error('Google sign-in is temporarily unavailable.');
  return nonce;
}
export async function googleLogin(credential: string, nonce: string, confirm18: boolean, password?: string): Promise<AuthResponse> {
  try {
    const response = await apiClient.post('/auth/google', {credential,nonce,confirm18,password});
    // Fetch the actual site profile, retaining the email on the original account.
    const session = unwrap<any>(response);
    const result = await buildSession(session, '');
    const profile = await fetchProfile(result.token);
    return {token:result.token,user:profile || result.user};
  } catch (error: any) {
    const code = error?.response?.data?.error || 'GOOGLE_UNAVAILABLE';
    const messages: Record<string,string> = {
      GOOGLE_LINK_PASSWORD_REQUIRED: 'This email already has an account. Enter its password to connect Google.',
      INVALID_CREDENTIALS: 'Incorrect account password.',
      CONFIRM_18_REQUIRED: 'Confirm that you are 18+ and agree to the terms before creating an account.',
      ACCOUNT_RESTRICTED: 'This account cannot sign in.',
      GOOGLE_2FA_UNSUPPORTED: 'Use your existing sign-in method for this account with two-factor protection.',
      GOOGLE_CHALLENGE_EXPIRED: 'Your Google sign-in expired. Please try again.',
      GOOGLE_INVALID_TOKEN: 'Google sign-in could not be verified. Please try again.',
      GOOGLE_RETRY: 'Please start Google sign-in again.',
      GOOGLE_NOT_CONFIGURED: 'Google sign-in is not enabled yet.',
      TOO_MANY_REQUESTS: 'Too many attempts. Please wait 15 minutes.',
    };
    throw new GoogleAuthError(code,messages[code] || 'Google sign-in is temporarily unavailable.');
  }
}

/**
 * Get current user (verify token/session)
 * Old backend route is GET /user (not /auth/me).
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await apiClient.get("/user");
    const raw = unwrap<any>(response);
    const user = raw?.user ?? raw;
    if (!user || typeof user !== "object" || user.id == null) return null;
    return mapBackendUserToFrontendUser(user);
  } catch (error: unknown) {
    console.warn("Error fetching current user:", error);
    return null;
  }
}
