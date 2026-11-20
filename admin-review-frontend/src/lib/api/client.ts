import axios, { AxiosInstance } from "axios";
import { useAuthStore } from "@/store/auth.store";

// Create axios instance with default config
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: typeof window === "undefined" ? (process.env.API_INTERNAL_BASE_URL || "http://127.0.0.1:3001") : "/api/v1",
    withCredentials: true,
    timeout: 30000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    (config) => {
      const token = useAuthStore.getState().token;
      const headers = (config.headers ?? {}) as any;
      // Only use the stored token if the caller did not set one explicitly
      // (login needs to send the brand-new token).
      // The old backend expects the raw token (NO "Bearer " prefix).
      if (token && !headers.Authorization) {
        headers.Authorization = String(token).replace(/^Bearer\s+/i, "");
      }
      config.headers = headers;
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Auto-logout on unauthorized
        try {
          useAuthStore.getState().logout();
        } catch {
          // ignore
        }
      } else if (error.response?.status === 500) {
        console.error("Server error");
      } else if (error.code === "ECONNREFUSED" || error.code === "ERR_NETWORK") {
        console.error("Network error - API may not be available:", error.message);
      }

      // warn (not error) so the red Next overlay does not pop up
      if (process.env.NODE_ENV === "development") {
        console.warn("API Error Details:", error.message);
      }

      return Promise.reject(error);
    }
  );

  return client;
};

export const apiClient = createApiClient();

