"use client";

import { type Battle } from "@/lib/api/battles";
import { Icon } from "@/components/ui/Icon";
import { Button, Image } from "@heroui/react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { useAuthStore } from "@/store/auth.store";

interface BattleHistoryCardProps {
  battle: Battle;
  onViewResults?: (battleId: string) => void;
}

export function BattleHistoryCard({ battle, onViewResults }: BattleHistoryCardProps) {
  // Split players into two teams (2v2 format)
  const team1 = battle.players.slice(0, 2);
  const team2 = battle.players.slice(2, 4);
  // Show first 6 packs
  const displayedPacks = battle.packs.slice(0, 6);

  const handleViewResults = () => {
    if (onViewResults) {
      onViewResults(battle.id);
    }
  };

  interface BattleCardProps {
    battle: Battle;
  }
  
  const getModeColor = (mode: Battle["mode"]) => {
    switch (mode) {
      case "SHARED":
        return "#eb808b";
      case "CLASSIC":
        return "#6c6c71";
      case "JACKPOT":
        return "#eb808b";
      case "ELIMINATION":
        return "#F5C542";
      default:
        return "#6c6c71";
    }
  };
  
  const getModeTextColor = (mode: Battle["mode"]) => {
    switch (mode) {
      case "SHARED":
        return "text-[#eb808b]";
      case "CLASSIC":
        return "text-[#6c6c71]";
      case "JACKPOT":
        return "text-[#eb808b]";
      case "ELIMINATION":
        return "text-[#F5C542]";
      default:
        return "text-[#6c6c71]";
    }
  };

  const modeColor = getModeColor(battle.mode);
  const modeTextColor = getModeTextColor(battle.mode);
  const statusText = battle.status;
  const isCompleted = battle.status === "completed";
  const actionLabel = isCompleted ? "View Battle" : "Open Battle";

  return (
    <>
      {/* Mobile Version */}
      <div
        className="w-full rounded-[10px] relative overflow-hidden p-2 md:hidden flex flex-col items-center justify-center py-4 gap-3"
        style={{
          background: `linear-gradient(to right, ${modeColor}5A 0%, ${modeColor}5A 20%, var(--background-elevated) 50%, var(--background-elevated) 100%)`
        }}
      >
        <span
          className="text-xs leading-[13px] tracking-[-0.02em] font-semibold"
          style={{ color: modeColor }}
        >
          {battle.mode}
        </span>

        {/* Players */}
        <div className="flex flex-row items-center gap-1">
          {battle.players.map((player, i) => (
            <Image
              key={player.id}
              src={player.avatar || "/assets/avatar/avatar (1).png"}
              alt={player.name || `Player ${i + 1}`}
              width={24}
              height={24}
              className="shrink-0 rounded-full"
            />
          ))}
          {battle.players.length < battle.playerCount && (
            <>
              <span className="text-xs leading-[13px] tracking-[-0.02em] font-semibold text-[#6c6c71] mx-1">
                VS
              </span>
              {battle.players.map(
                (player, index) => (
                  <div
                    key={player.id}
                    className="w-6 h-6 bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-full flex items-center justify-center"
                  >
                    <Image src={player.avatar || "/assets/avatar/dummy.png"} alt={player.name || `Player ${index + 1}`} width={24} height={24} className="shrink-0 rounded-full" />
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* Cost */}
        <div className="flex flex-col items-start gap-2">
          <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
            Cost: {battle.cost}
          </span>
        </div>

        {/* Packs Container */}
        <div className="bg-background-sunken border border-[rgba(63,71,84,0.24)] rounded-md relative flex px-2 max-w-full py-1">
          <div className="flex flex-row items-center gap-2 overflow-x-auto scrollbar-hide">
            {battle.packs.map((pack, i) => (
              <div key={i} className="w-[60px] relative shrink-0">
                <Image src={pack.image} alt={pack.name} width={60} height={96} />
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <span className="uppercase leading-[15px] tracking-[-0.02em] font-medium text-white">
            {statusText}
          </span>
        </div>

        {/* Action Button */}
        <div>
          {onViewResults ? (
            <Button
              onPress={handleViewResults}
              variant={isCompleted ? "faded" : "solid"}
              size="md"
              className={cn("h-8 text-white px-2", isCompleted ? "bg-[rgba(63,71,84,0.24)]" : "mcPrimary")}
            >
              {!isCompleted && <Icon name="adventure" className="w-4 h-4 mr-1" />}
              {actionLabel}
            </Button>
          ) : (
            <Link href={`/battles/${battle.id}`}>
              <Button
                variant={isCompleted ? "faded" : "solid"}
                size="md"
                className={cn("h-8 text-white px-2", isCompleted ? "bg-[rgba(63,71,84,0.24)]" : "mcPrimary")}
              >
                {!isCompleted && <Icon name="adventure" className="w-4 h-4 mr-1" />}
                {actionLabel}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Desktop Version */}
      <div
        className={cn(
          "grid-cols-12 w-full h-[160px] rounded-[10px] relative overflow-hidden p-2 hidden md:grid"
        )}
        style={{
          background: `linear-gradient(to right, ${modeColor} 0%, ${modeColor} 20%, var(--background-elevated) 50%, var(--background-elevated) 100%)`
        }}
      >
        {/* Packs Section */}
        <div className="col-span-7 h-[144px] bg-background-sunken border border-[rgba(63,71,84,0.24)] rounded-md relative items-center flex px-2 mr-6">
          <div className="h-[128px] flex flex-row items-center gap-2 overflow-x-auto scrollbar-hide">
            {battle.packs.map((pack, i) => (
              <div key={i} className="w-[80px] h-[128px] relative shrink-0">
                <Image src={pack.image} alt={pack.name} width={80} height={128} classNames={{wrapper:"w-full"}} />
              </div>
            ))}
          </div>

          {/* Pack Count Badge */}
          <div className="absolute z-10 w-9 h-6 right-2 top-1 flex flex-row justify-center items-center gap-1 px-1.5 py-1 bg-background-elevated border border-[rgba(63,71,84,0.24)] rounded-full">
            <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
              {battle.packCount}
            </span>
            <Icon name="cards" className="w-4 h-4" />
          </div>
        </div>

        {/* Info Section */}
        <div className="col-span-5 h-full flex flex-col items-start justify-end gap-4 relative p-2">
          {/* Mode Label */}
          <span
            className="text-xs leading-[13px] tracking-[-0.02em] font-semibold"
            style={{ color: modeColor }}
          >
            {battle.mode}
          </span>

          {/* Players */}
          <div className="flex flex-row items-center gap-1">
            {battle.players.map((player, i) => (
              <Image
                key={player.id}
                src={player.avatar || "/assets/avatar/avatar (1).png"}
                alt={player.name || `Player ${i + 1}`}
                width={24}
                height={24}
                className="shrink-0 rounded-full"
              />
            ))}
            {battle.players.length < battle.playerCount && (
              <>
                <span className="text-xs leading-[13px] tracking-[-0.02em] font-semibold text-text-muted mx-1">
                  VS
                </span>
                {Array.from({ length: battle.playerCount - battle.players.length }).map(
                  (_, index) => (
                    <div
                      key={`placeholder-${index}`}
                      className="w-6 h-6 bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-full flex items-center justify-center"
                    >
                      <span className="text-xs leading-[13px] tracking-[-0.02em] font-semibold text-[#6c6c71]">
                        ?
                      </span>
                    </div>
                  )
                )}
              </>
            )}
          </div>

          {/* Cost */}
          <div className="flex flex-col items-start gap-2 w-[128px]">
            <div className="flex flex-col items-start gap-2 w-[70px]">
              <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                Cost: {battle.cost}
              </span>
            </div>
          </div>


          {/* View Results Button */}
          <Button
            onPress={handleViewResults}
            className="absolute right-5 bottom-2 flex flex-row justify-center items-center px-5 py-2.5 gap-1  h-8 bg-[rgba(63,71,84,0.24)] rounded-full"
          >
            <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
              View Results
            </span>
          </Button>
        </div>
      </div>
    </>
  );
}
