import React from "react";
import BattlesPage from "@/components/battles/BattlesPage";

/**
 * Battles list is always fetched on the client (like home page Battle Highlights).
 * Server-side fetch fails in production when the Node server can't reach the API.
 */
export default function Battles() {
  return <BattlesPage />;
}
