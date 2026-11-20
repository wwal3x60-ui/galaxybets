"use client";

import { Image } from "@heroui/react";
import { type EventWinner } from "@/lib/api/events";

interface LeaderboardRowProps {
  winner: EventWinner;
}

export function LeaderboardRow({ winner }: LeaderboardRowProps) {
  return (
    <>
      {/* Rank */}
      <div className="flex flex-col justify-center items-center px-2.5 gap-2.5 w-[50px] h-5">
        <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-[#6c6c71]">
          {winner.rank}
        </span>
      </div>

      {/* Winner Info */}
      <div className="flex flex-col justify-center items-start gap-2.5 w-[350px] h-5">
        <div className="flex flex-row items-center gap-1">
          {/* Avatar */}
          <div className="w-5 h-5 rounded-full overflow-hidden shrink-0">
            <Image
              src={winner.avatar}
              alt={winner.name}
              width={20}
              height={20}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Name */}
          <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
            {winner.name}
          </span>
        </div>
      </div>

      {/* Tickets */}
      <div className="flex flex-col justify-center items-start gap-2.5 w-[200px] h-[17px]">
        <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
          {winner.tickets}
        </span>
      </div>

      {/* Reward */}
      <div className="flex flex-col items-end gap-2.5 w-[200px] h-[17px]">
        <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-[#eb808b]">
          {winner.reward}
        </span>
      </div>
    </>
  );
}
