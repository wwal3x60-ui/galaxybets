import React from "react";
import RewardsPage from "@/components/rewards/WagerRewardsPage";

/**
 * Rewards data is fetched on the client so the request includes the auth token
 * (server has no access to the stored token).
 */
export default function Rewards() {
  return <RewardsPage />;
}
