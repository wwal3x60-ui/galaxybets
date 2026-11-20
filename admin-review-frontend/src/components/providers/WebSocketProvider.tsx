"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth.store";
import { initializePublicWebSocket, initializeWebSocket, useWebSocket, websocketManager } from "@/lib/websocket";
import { getWalletBalance } from "@/lib/api/wallet";
import { getCartItems } from "@/lib/api/cart";
import { ToastProvider } from "@heroui/react";
import { addToast } from "@/lib/toast";

/**
 * Global WebSocket provider component
 * Handles WebSocket connection and events for the entire app
 */
export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { token, isAuthenticated, user, setUser, updateUser } = useAuthStore();
  const hasConnectedRef = useRef(false);
  const connectionAttemptedRef = useRef(false);
  const lastConnectAuthRef = useRef<{ token: string | null; isAuthenticated: boolean }>({ token: null, isAuthenticated: false });

  const refreshBalance = async () => {
    if (!token) return;
    try {
      const wallet = await getWalletBalance();
      if (wallet) {
        updateUser({ walletBalance: wallet.balance });
      }
    } catch (error) {
      console.error("[WebSocketProvider] Failed to refresh balance:", error);
    }
  };

  const refreshCartCount = async () => {
    if (!token) return;
    try {
      const cart = await getCartItems("AVAILABLE");
      updateUser({ cartCount: cart?.length });
    } catch (error) {
      console.error("[WebSocketProvider] Failed to refresh cart:", error);
    }
  };

  // Setup WebSocket handlers
  useWebSocket({
    onConnect: () => {
      console.log("[WebSocketProvider] Connected to WebSocket server");
      hasConnectedRef.current = true;
    },
    onDisconnect: () => {
      console.log("[WebSocketProvider] Disconnected from WebSocket server");
      hasConnectedRef.current = false;
    },
    onError: (error) => {
      console.error("[WebSocketProvider] WebSocket error:", error);
    },
    onDepositStatusUpdated: (data) => {
      console.log("[WebSocketProvider] Deposit status updated:", data);
      
      // Show toast notification
      const statusMessages: Record<string, { title: string; description: string; color?: "success" | "danger" | "warning" | "default" }> = {
        PENDING: { title: "Deposit Pending", description: "Your deposit is pending confirmation" },
        PROCESSING: { title: "Deposit Processing", description: "Your deposit is being processed" },
        COMPLETED: { title: "Deposit Completed", description: `Your deposit of $${data.amount || 'N/A'} has been completed`, color: "success" },
        FAILED: { title: "Deposit Failed", description: "Your deposit could not be processed", color: "danger" },
      };
      
      const message = statusMessages[data.status] || { 
        title: "Deposit Update", 
        description: `Deposit status: ${data.status}` 
      };
      
      addToast({
        title: message.title,
        description: message.description,
        color: message.color || "default",
      });

      // Refresh wallet balance when deposit status changes
      if (token) {
        refreshBalance();
      }
    },
    onDepositProcessing: (data) => {
      console.log("[WebSocketProvider] Deposit processing:", data);
      addToast({
        title: "Deposit Processing",
        description: "Your deposit is being processed",
      });
    },
    onDepositCompleted: (data) => {
      console.log("[WebSocketProvider] Deposit completed:", data);
      addToast({
        title: "Deposit Completed",
        description: `Your deposit of $${data.amount} has been completed`,
        color: "success",
      });
      // Refresh wallet balance when deposit completes
      if (token) {
        refreshBalance();
      }
    },
    onDepositFailed: (data) => {
      console.log("[WebSocketProvider] Deposit failed:", data);
      addToast({
        title: "Deposit Failed",
        description: data.error || "Your deposit could not be processed",
        color: "danger",
      });
    },
    onWalletBalanceUpdated: (data) => {
      console.log("[WebSocketProvider] Wallet balance updated:", data);
      // Prefer server-provided balance if present, otherwise refetch.
      if (typeof (data as any)?.walletBalance === "string") {
        updateUser({ walletBalance: (data as any).walletBalance });
        return;
      }
      if (typeof (data as any)?.balance === "string") {
        updateUser({ walletBalance: (data as any).balance });
        return;
      }
      refreshBalance();
    },
    onCartUpdated: (data) => {
      console.log("[WebSocketProvider] Cart updated:", data);
      // Prefer server-provided count if present, otherwise refetch.
      if (typeof data?.cartCount === "number") {
        updateUser({ cartCount: data.cartCount });
        return;
      }
      // Backward-compat: some endpoints used `{ count }`
      if (typeof (data as any)?.count === "number") {
        updateUser({ cartCount: (data as any).count });
        return;
      }
      refreshCartCount();
    },
  });

  // Always keep a websocket connection:
  // - unauthenticated connection for guests (homepage realtime)
  // - authenticated connection for logged-in users (wallet/deposit/cart events)
  useEffect(() => {
    const prev = lastConnectAuthRef.current;
    const authChanged = prev.token !== (token ?? null) || prev.isAuthenticated !== isAuthenticated;
    lastConnectAuthRef.current = { token: token ?? null, isAuthenticated };
    connectionAttemptedRef.current = true;

    // Only trigger connect when auth actually changed (avoids duplicate connections in production build).
    if (!authChanged && (websocketManager.isConnected() || websocketManager.getStatus().state === "connecting")) return;
    if (isAuthenticated && token) {
      initializeWebSocket(token);
    } else {
      initializePublicWebSocket();
    }

    return () => {
      // keep socket lifetime tied to app; let it disconnect naturally on page unload
    };
  }, [isAuthenticated, token]);

  // Reconnect on disconnect (public or authenticated depending on current auth)
  useEffect(() => {
    if (!connectionAttemptedRef.current) return;

    const checkConnection = () => {
      if (!websocketManager.isConnected() && hasConnectedRef.current && connectionAttemptedRef.current) {
        // Was connected but now disconnected - reconnect
        console.log("[WebSocketProvider] Reconnecting after disconnect...");
        if (isAuthenticated && token) initializeWebSocket(token);
        else initializePublicWebSocket();
      }
    };

    const interval = setInterval(checkConnection, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, token]);

  return (
    <>
      <ToastProvider placement="top-center" maxVisibleToasts={2} toastOffset={12} />
      {children}
    </>
  );
}
