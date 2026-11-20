"use client";

import { type FreePack } from "@/lib/api/rewards";
import { Image } from "@heroui/react";

interface FreePackCardProps {
  freePack: FreePack;
  onClaim?: (packId: string) => void;
}

export default function FreePackCard({ freePack, onClaim }: FreePackCardProps) {
  return (
    <div className="relative w-full bg-[rgba(63,71,84,0.12)] rounded-[10px] overflow-hidden">
      <div className=" inset-0 flex flex-col items-center justify-center" >
        {/* Lock Icon */}
        <Image src={freePack.image} alt={freePack.level.toString()} className="w-full"/>
        
        {/* Level Text */}
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71] py-2">
          Free Level {freePack.level}
        </span>
      </div>
    </div>
  );
}
