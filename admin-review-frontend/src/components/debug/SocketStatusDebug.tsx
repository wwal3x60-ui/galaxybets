"use client";

import React, { useEffect, useState } from "react";
import { getWebSocketStatusSnapshot, subscribeWebSocketStatus, type WebSocketStatusSnapshot } from "@/lib/websocket";

type Props = {
  /**
   * If false, the component renders nothing.
   * Enable explicitly with NEXT_PUBLIC_SHOW_SOCKET_DEBUG=1.
   */
  enabled?: boolean;
  className?: string;
};

export function SocketStatusDebug({ enabled = process.env.NEXT_PUBLIC_SHOW_SOCKET_DEBUG === "1", className }: Props) {
  const [status, setStatus] = useState<WebSocketStatusSnapshot>(() => getWebSocketStatusSnapshot());

  useEffect(() => {
    if (!enabled) return;
    return subscribeWebSocketStatus(setStatus);
  }, [enabled]);

  if (!enabled) return null;

  const badge =
    status.state === "connected"
      ? "bg-emerald-600"
      : status.state === "connecting"
        ? "bg-amber-600"
        : status.state === "error"
          ? "bg-red-600"
          : "bg-slate-600";

  return (
    <div
      className={[
        "fixed bottom-3 right-3 z-9999 w-[340px] rounded-md border border-white/10 bg-black/70 backdrop-blur px-3 py-2 text-xs text-white",
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">Socket</div>
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${badge}`} />
          <span className="uppercase tracking-wide">{status.state}</span>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-white/80">
        <div className="text-white/50">connected</div>
        <div>{String(status.connected)}</div>

        <div className="text-white/50">socketId</div>
        <div className="truncate" title={status.socketId ?? ""}>
          {status.socketId ?? "-"}
        </div>

        <div className="text-white/50">transport</div>
        <div>{status.transport ?? "-"}</div>

        <div className="text-white/50">reconnect</div>
        <div>
          {status.reconnectAttempts}/{status.maxReconnectAttempts}
        </div>

        <div className="text-white/50">lastError</div>
        <div className="truncate" title={status.lastError ?? ""}>
          {status.lastError ?? "-"}
        </div>
      </div>
    </div>
  );
}

