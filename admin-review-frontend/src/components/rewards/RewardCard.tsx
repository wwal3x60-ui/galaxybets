"use client";

import { type Reward } from "@/lib/api/rewards";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { formatPriceDisplay } from "@/lib/utils/format";

interface RewardCardProps {
  reward: Reward;
  onClaim?: (rewardId: string) => void;
}

const getIconName = (type: Reward["type"]) => {
  switch (type) {
    case "daily":
      return "award";
    case "weekly":
      return "medal";
    case "monthly":
      return "trophy2";
    default:
      return "gift";
  }
};

export default function RewardCard({ reward, onClaim }: RewardCardProps) {
  const iconName = reward.icon || getIconName(reward.type);

  return (
    <div className="relative w-full h-[153px] bg-[rgba(63,71,84,0.12)] rounded-[10px] overflow-hidden shrink-0">
      {/* Content */}
      <div className="relative flex flex-col items-start gap-1 p-3 h-full">
        {/* Title and Description */}
        <div className="flex flex-col flex-1 items-start gap-1">
          <h3 className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
            {reward.title}
          </h3>
          <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71] w-2/3">
            {reward.description}
          </p>
        </div>

        {/* Award Icon - Positioned absolutely */}
        <div className="absolute right-4 top-20 ">
          <div className="w-full h-full flex items-center justify-center">
            <Icon name={`${iconName}`} className="w-20 h-20 text-[#E89B05]" />
          </div>
        </div>

        {/* Claim Button */}
        <div className="">
          <Button
            variant="primary"
            size="md"
            className="w-[133px] h-9 bg-[#38393d] text-[#6c6c71] hover:mcPrimary"
            disabled={!reward.canClaim}
            onClick={() => onClaim?.(reward.id)}
          >
            {reward.canClaim
              ? (reward.amount != null && Number(reward.amount) > 0
                  ? `Claim $${formatPriceDisplay(reward.amount ?? 0)}`
                  : "Claim")
              : "Nothing to Claim"}
          </Button>
        </div>
      </div>
    </div>
  );
}
