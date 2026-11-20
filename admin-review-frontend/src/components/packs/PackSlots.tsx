"use client";

import { Button, Image, Popover, PopoverContent, PopoverTrigger, Snippet } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils/cn";
import { type PackDetails } from "@/lib/api/packs";



interface PackSlotsProps {
  selectedPacks: PackDetails[];
  totalSlots?: number;
  onSlotClick: () => void;
  updateSelectedPacks: (packs: PackDetails[]) => void;
  slotSeedHashes: Record<number, string>;
}

export default function PackSlots({
  selectedPacks,
  totalSlots = 6,
  onSlotClick,
  updateSelectedPacks,
  slotSeedHashes,
}: PackSlotsProps) {
  const slots = Array.from({ length: totalSlots }).map((_, index) => {
    const pack = selectedPacks[index];
    return pack ? { ...pack, index } : { index, isEmpty: true };
  });
  const removePack = (slotIndex: number) => {
    if (slotIndex < 0 || slotIndex >= selectedPacks.length) return;
    const updatedPacks = selectedPacks.filter((_, i) => i !== slotIndex);
    updateSelectedPacks(updatedPacks);
  };
  const addPack = (pack: PackDetails) => {
    updateSelectedPacks([...selectedPacks, pack]);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 w-full mx-auto px-4 overflow-x-auto scrollbar-hide">
      {slots.map((slot, idx) => {
        if (slot.isEmpty) {
          return (
            <button
              key={idx}
              aria-label={`Choose a case for slot ${idx + 1}`}
              onClick={onSlotClick}
              className="flex flex-col items-center justify-center w-[128px] h-[160px] border border-dashed border-[rgba(63,71,84,0.24)] rounded-lg shrink-0 hover:bg-[rgba(63,71,84,0.12)] transition-colors"
            >
              <Icon name="plus" className="w-5 h-5 text-text-muted" />
            </button>
          );
        }

        const pack = slot as PackDetails & { index: number };
        return (
          <div key={idx} className="flex flex-col items-start gap-3 shrink-0 w-[128px] relative">
            <div className="group w-full h-full flex items-center justify-center border border-[rgba(63,71,84,0.24)] rounded-lg overflow-hidden">
              <Image
                src={pack.template?.imageUrl || pack.image}
                alt={pack.template?.name || pack.name}
                width={100}
                height={160}
                className="object-contain"
              />
              <div className="hidden group-hover:flex transition-all duration-300 absolute left-0 top-0 w-full h-full bg-black/70 rounded-lg z-10 items-center justify-center" >
                <div className="flex items-center gap-2">
                  {idx !== 0 && (
                    <Button
                      aria-label={`Remove ${pack.name} from slot ${idx + 1}`}
                      variant="light"
                      size="sm"
                      className="min-w-0 w-8 h-8 bg-white/70 border-white/40 border"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePack(idx);
                      }}
                    >
                      <Icon name="trash" className="w-5 h-5 text-text-muted" />
                    </Button>
                  )}
                  <Button
                    aria-label={`Add another ${pack.name}`}
                    variant="light"
                    size="sm"
                    className="min-w-0 w-8 h-8 bg-white/70 border-white/40 border"
                    onClick={(e) => {
                      e.stopPropagation();
                      addPack(pack);
                    }}
                  >
                    <Icon name="plus" className="w-5 h-5 text-text-muted" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
