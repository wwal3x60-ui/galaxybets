"use client";

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import SlotMachine, { SlotMachineHandle } from "./SlotMachine";
import { type PackDetails, type PackItem } from "@/lib/api/packs";

interface PackDrawingViewProps {
  selectedPacks: PackDetails[];
  onSpinComplete?: (results: PackItem[]) => void;
  fastOpen?: boolean;
  sequential?: boolean; // If true, spin packs one by one sequentially
  forceVertical?: boolean; // If true, force vertical spinning mode regardless of pack count
  slotIndexOffset?: number; // Used to avoid SlotMachine slotIndex collisions (e.g. multi-player battles)
  /** "special" = open-pack mode (reel stop plays special_win); "basic" = battle mode */
  winSound?: "basic" | "special";
  celebrateDrops?: boolean;
}

export interface PackDrawingViewHandle {
  spin: () => void;
}

const PackDrawingView = forwardRef<PackDrawingViewHandle, PackDrawingViewProps>(({
  selectedPacks,
  onSpinComplete,
  fastOpen = false,
  sequential = false,
  forceVertical = false,
  slotIndexOffset = 0,
  winSound = "basic",
  celebrateDrops = false,
}, ref) => {
  const slotMachineRefs = useRef<(SlotMachineHandle | null)[]>([]);
  const spinWatchdogRef = useRef<number | null>(null);
  const didCompleteCycleRef = useRef(false);
  const [spinResults, setSpinResults] = useState<PackItem[]>([]);
  const [completedSpins, setCompletedSpins] = useState(0);
  const [currentPackIndex, setCurrentPackIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const totalPacks = selectedPacks.length;
  // Use forceVertical if provided, otherwise use default logic (vertical if 3+ packs)
  const isVertical = forceVertical || totalPacks >= 3;

  // Ensure refs array is properly sized
  useEffect(() => {
    slotMachineRefs.current = slotMachineRefs.current.slice(0, selectedPacks.length);
  }, [selectedPacks.length]);

  // Expose spin function via ref
  useImperativeHandle(ref, () => ({
    spin: () => {
      if (selectedPacks.length === 0) return;

      // Reset state
      didCompleteCycleRef.current = false;
      setCompletedSpins(0);
      setSpinResults([]);
      setCurrentPackIndex(0);
      setIsSpinning(true);

      // Watchdog: ensure we always complete even if a ref is missing
      if (spinWatchdogRef.current) {
        window.clearTimeout(spinWatchdogRef.current);
      }
      spinWatchdogRef.current = window.setTimeout(() => {
        // Force completion to avoid UI getting stuck
        const allResults = spinResults.filter(Boolean);
        // if (onSpinComplete && totalPacks > 0) {
        //   onSpinComplete(allResults);
        // }
        setIsSpinning(false);
      }, 6000);

      const tryStart = (attempt = 0) => {
        const needed = sequential ? 1 : selectedPacks.length;
        const availableCount = slotMachineRefs.current.slice(0, needed).filter(Boolean).length;
        if (availableCount < needed && attempt < 20) {
          // Refs not ready yet; try again shortly
          setTimeout(() => tryStart(attempt + 1), 50);
          return;
        }

        if (sequential) {
          const firstSlotRef = slotMachineRefs.current[0];
          firstSlotRef?.spin();
        } else {
          // Parallel mode: spin all packs at once
          slotMachineRefs.current.slice(0, selectedPacks.length).forEach((slotRef) => {
            slotRef?.spin();
          });
        }
      };

      // Small delay to ensure refs are set
      setTimeout(() => tryStart(0), 50);
    }
  }));

  const handleSpinStart = () => {
    // Spin started for this pack
  };

  const handleSpinEnd = (packIndex: number) => (result: PackItem) => {
    // Spin completed for this pack
    setSpinResults((prev) => {
      const newResults = [...prev];
      newResults[packIndex] = result;
      return newResults;
    });

    setCompletedSpins((prev) => {
      const newCount = prev + 1;

      // If sequential mode, spin next pack
      if (sequential && newCount < totalPacks) {
        const nextPackIndex = packIndex + 1;
        setCurrentPackIndex(nextPackIndex);

        // Small delay before spinning next pack
        setTimeout(() => {
          const nextSlotRef = slotMachineRefs.current[nextPackIndex];
          if (nextSlotRef) {
            nextSlotRef.spin();
          }
        }, 300);
      } else if (sequential && newCount === totalPacks) {
        // All packs completed in sequential mode
        setIsSpinning(false);
      } else if (!sequential && newCount === totalPacks) {
        // All packs completed in parallel mode
        setIsSpinning(false);
      }
      return newCount;
    });


  };

  // Call onSpinComplete when all spins are done
  useEffect(() => {
    if (didCompleteCycleRef.current) return;
    if (completedSpins !== totalPacks || totalPacks <= 0) return;

    const allResults = spinResults.filter(Boolean);
    if (allResults.length !== totalPacks) return;

    didCompleteCycleRef.current = true;
    onSpinComplete?.(allResults);

    // Reset after all spins are done (so next click starts clean)
    setIsSpinning(false);
    setCompletedSpins(0);
    setSpinResults([]);
    setCurrentPackIndex(0);
  }, [completedSpins, totalPacks, spinResults, onSpinComplete]);

  // Clear watchdog when spins complete
  useEffect(() => {
    if (completedSpins === totalPacks && totalPacks > 0) {
      if (spinWatchdogRef.current) {
        window.clearTimeout(spinWatchdogRef.current);
        spinWatchdogRef.current = null;
      }
    }
  }, [completedSpins, totalPacks]);

  if (selectedPacks.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-[400px] bg-background-sunken border-x border-[rgba(63,71,84,0.24)]">
        <p className="text-text-muted">Select cases to start</p>
      </div>
    );
  }

  // Container: always flex-row for multiple machines
  // isVertical controls the spinning direction inside each SlotMachine
  const containerClass = `flex gap-4 items-center justify-center py-12 w-full h-[450px] overflow-hidden bg-background-sunken border-[rgba(63,71,84,0.24)]  ${isVertical ? "flex-row" : "flex-col"}`;

  // In sequential mode, only show the current pack being spun
  const packsToShow = sequential
    ? [selectedPacks[currentPackIndex]].filter(Boolean)
    : selectedPacks;

  return (
    <div data-pack-reel={isVertical ? "vertical" : "horizontal"} className={containerClass}>
      {packsToShow.map((pack, displayIndex) => {
        // In sequential mode, use currentPackIndex; otherwise use displayIndex
        const packIndex = sequential ? currentPackIndex : displayIndex;

        return (
          <div key={packIndex} className={`relative flex items-center justify-center ${isVertical ? "w-30" : "w-full"}`}>
            <SlotMachine
              ref={(el) => {
                slotMachineRefs.current[packIndex] = el;
              }}
              pack={pack}
              slotIndex={slotIndexOffset + packIndex}
              isVertical={isVertical}
              fastOpen={fastOpen}
              winSound={winSound}
              celebrateDrop={celebrateDrops}
              onSpinStart={handleSpinStart}
              onSpinEnd={handleSpinEnd(packIndex)}
            />
            {/* Corner decorations overlay */}
            <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none ${isVertical ? "w-20 h-20" : "w-40 h-40"}`}>
              <div className="relative w-full h-full">
                <div className="w-2 h-2 border-text-muted border-l-1 border-t-1 absolute top-0 left-0"></div>
                <div className="w-2 h-2 border-text-muted border-r-1 border-t-1 absolute top-0 right-0"></div>
                <div className="w-2 h-2 border-text-muted border-b-1 border-l-1 absolute bottom-0 left-0"></div>
                <div className="w-2 h-2 border-text-muted border-r-1 border-b-1 absolute bottom-0 right-0"></div>
              </div>
            </div>
            {/* Pack progress indicator in sequential mode */}
            {/* {sequential && totalPacks > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-text-muted">
                Pack {packIndex + 1} of {totalPacks}
              </div>
            )} */}
          </div>
        );
      })}
    </div>
  );
});

PackDrawingView.displayName = 'PackDrawingView';

export default PackDrawingView;
