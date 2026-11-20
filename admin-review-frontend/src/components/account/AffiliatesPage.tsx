"use client";

import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import { addToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import {
  type AffiliateStats,
  getAffiliateStats,
  claimAllReferralEarnings,
} from "@/lib/api/affiliates";
import { formatPriceDisplay } from "@/lib/utils/format";
import { cleanNumber } from "@/lib/utils/numbers";

export function AffiliatesPage() {
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await getAffiliateStats();
      setStats(data);
    } catch (error) {
      console.error("Error fetching affiliate stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleCopyCode = async () => {
    if (stats?.referralCode) {
      try {
        await navigator.clipboard.writeText(stats.referralCode);
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    }
  };

  // Invite link: homepage with ?ref= so ref is stored in localStorage; signup is via modal (no /signup page)
  const inviteLink =
    typeof window !== "undefined" && stats?.referralCode
      ? `${window.location.origin}/?ref=${stats.referralCode}`
      : "";

  const handleCopyInviteLink = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink);
      } catch (error) {
        console.error("Failed to copy:", error);
      }
    }
  };

  const handleClaimAll = async () => {
    if (!stats || isClaiming) return;
    setIsClaiming(true);
    try {
      const result = await claimAllReferralEarnings();
      await fetchStats();
      if (result && result.count > 0) {
        const amount = formatPriceDisplay(result.claimedAmount ?? "0");
        addToast({ title: "Claimed", description: `${amount} added to your wallet.`, color: "success" });
      } else if (result && result.count === 0) {
        addToast({ title: "Nothing to claim", description: "You have no unclaimed affiliate earnings.", color: "default" });
      }
    } catch (error) {
      console.error("Failed to claim:", error);
      addToast({
        title: "Claim failed",
        description: error instanceof Error ? error.message : "Could not claim affiliate earnings. Try again.",
        color: "danger",
      });
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col items-start gap-10 w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Affiliates
        </h2>
        <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Loading affiliate statistics...
        </p>
      </div>
    );
  }

  const hasReferralCode = !!stats.referralCode;
  const displayCode = stats.referralCode ?? "N/A";
  const hasUnclaimed = cleanNumber(parseFloat(stats.unclaimedAmount), 2) > 0;

  return (
    <div className="flex flex-col items-start gap-5 w-full">
      {/* Header */}
      <div className="flex flex-row justify-between items-center w-full">
        <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
          Affiliates
        </h2>
        {hasReferralCode && (
          <Button
            onPress={handleCopyInviteLink}
            className="h-9 px-4 bg-[rgba(63,71,84,0.24)] rounded-full"
          >
            <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
              Copy Invite Link
            </span>
            <Icon name="copy" className="w-5 h-5 text-white" />
          </Button>
        )}
      </div>

      {/* Your Referral Code (read-only) */}
      <div className="grid gird-cols-1 md:grid-cols-2 gap-4 w-full">
      <div className="relative flex flex-col items-start gap-4 p-4 bg-[rgba(63,71,84,0.12)] rounded-md w-full max-w-md">
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Your Referral Code
        </span>
        <div className="flex flex-row items-center gap-4 w-full">
          <span className="text-2xl leading-[26px] tracking-[-0.02em] font-medium text-white">
            {displayCode}
          </span>
          {hasReferralCode && (
            <Button
              onPress={handleCopyCode}
              className="w-9 h-9 bg-[rgba(63,71,84,0.24)] rounded-full p-0 min-w-0"
            >
              <Icon name="copy" className="w-5 h-5 text-white" />
            </Button>
          )}
        </div>
      </div>

      {/* Referred by */}
      <div className="relative flex flex-col items-start gap-4 p-4 bg-[rgba(63,71,84,0.12)] rounded-md w-full max-w-md">
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Referred by
        </span>
        <span className="text-2xl leading-[26px] tracking-[-0.02em] font-medium text-white">
          {stats.referredByCode ? `${stats.referredByCode}` : "—"}
        </span>
      </div>

      {/* Invite link (when code exists) */}
      {/* {hasReferralCode && (
        <div className="relative flex flex-col items-start gap-4 p-4 bg-[rgba(63,71,84,0.12)] rounded-md w-full max-w-md">
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
            Invite link
          </span>
          <div className="flex flex-row items-center gap-2 w-full flex-wrap">
            <span className="text-sm leading-[20px] text-white break-all">
              {inviteLink}
            </span>
            <Button
              onPress={handleCopyInviteLink}
              size="sm"
              className="shrink-0 bg-[rgba(63,71,84,0.24)] rounded-full"
            >
              <Icon name="copy" className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>
      )} */}

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/60">Historical referred wagers</p><strong className="mt-2 block text-xl text-white">{formatPriceDisplay(stats.totalWagered)}</strong></div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4"><p className="text-sm text-white/60">Approved referred deposits</p><strong className="mt-2 block text-xl text-white">{formatPriceDisplay(stats.totalDeposited)}</strong></div>
      </div>
      {/* Stats Grid */}
        <div className="flex flex-col items-start gap-4 p-4 bg-[rgba(63,71,84,0.12)] rounded-md">
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
            Users referred
          </span>
          <span className="text-2xl leading-[26px] tracking-[-0.02em] font-medium text-white">
            {stats.referralsCount}
          </span>
        </div>

        <div className="flex flex-col items-start gap-4 p-4 bg-[rgba(63,71,84,0.12)] rounded-md">
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
            Total earned
          </span>
          <span className="text-2xl leading-[26px] tracking-[-0.02em] font-medium text-white">
            {formatPriceDisplay(stats.totalEarned)}
          </span>
        </div>

        <div className="flex flex-col items-start gap-4 p-4 bg-[rgba(63,71,84,0.12)] rounded-md">
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
            Unclaimed
          </span>
          <span className="text-2xl leading-[26px] tracking-[-0.02em] font-medium text-white">
            {formatPriceDisplay(stats.unclaimedAmount)}
          </span>
        </div>

        <div className="flex flex-col items-start gap-4 p-4 bg-[rgba(63,71,84,0.12)] rounded-md">
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
            Claimed
          </span>
          <span className="text-2xl leading-[26px] tracking-[-0.02em] font-medium text-white">
            {formatPriceDisplay(stats.claimedAmount)}
          </span>
        </div>
      </div>

      {/* Claim all */}
      <div className="flex flex-col items-start gap-4 p-4 w-full bg-[rgba(63,71,84,0.12)] rounded-md">
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
          Amount to claim
        </span>
        <div className="flex flex-row justify-between items-center gap-4 w-full">
          <div className="flex flex-row items-center gap-2 px-1 py-2 bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-md">
            <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white px-2">
              {formatPriceDisplay(stats.unclaimedAmount)}
            </span>
          </div>
          <Button
            onPress={handleClaimAll}
            isDisabled={!hasUnclaimed || isClaiming}
            className="h-9 px-4 bg-[rgba(63,71,84,0.24)] rounded-full"
          >
            <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
              {isClaiming ? "Claiming…" : "Claim all"}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}
