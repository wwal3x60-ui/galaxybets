"use client";

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback } from "react";
import { cn } from "@heroui/react";
import { PackDetails, PackItem } from "@/lib/api/packs";
import { useSpinStore } from "@/store/spin.store";
import { playTick, playBasicWin, playSpecialWin, unlockAudio } from "@/lib/audio";
import Image from "next/image";
import { sampleDemoDrop } from "@/lib/utils/sample-pack-drop";

interface SlotMachineProps {
  pack: PackDetails;
  slotIndex: number; // Which slot this SlotMachine represents (0..5)
  isVertical?: boolean; // true = vertical spinning, false = horizontal spinning
  /** "basic" = reel stop sound in battle; "special" = reel stop sound in open-pack mode */
  fastOpen?: boolean;
  celebrateDrop?: boolean;
  winSound?: "basic" | "special";
  onSpinStart?: () => void;
  onSpinEnd?: (result: PackItem) => void;
}

export interface SlotMachineHandle {
  spin: () => void;
}

const SlotMachine = forwardRef<SlotMachineHandle, SlotMachineProps>(
  ({ pack, slotIndex, isVertical = true, winSound = "basic", fastOpen = false, onSpinStart, onSpinEnd }, ref) => {
    const packItems = pack?.items ?? [];
    const [isSpinning, setIsSpinning] = useState(false);
    const isSpinningRef = useRef(false);
    const spinTokenRef = useRef(0);
    const completedTokenRef = useRef<number | null>(null);
    const spinStartedAtRef = useRef<number>(0);
    const [translateY, setTranslateY] = useState(0);
    const [translateX, setTranslateX] = useState(0);
    const [items, setItems] = useState<PackItem[]>([]);
    // Index of the item the reel stopped on (used to show its price under the drop)
    const [hitIndex, setHitIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const startTimeoutRef = useRef<number | null>(null);
    const finishTimeoutRef = useRef<number | null>(null);
    const twistFinishTimeoutRef = useRef<number | null>(null);
    const preloadedImagesRef = useRef<Set<string>>(new Set());
    const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
    const rafTickRef = useRef(0);
    const lastCenterIndexRef = useRef<number | null>(null);
    const lastTickAtRef = useRef<number>(0);

    // Reel configuration
    const TOTAL_ITEMS = 35;
    const FORCED_TARGET_INDEX = 30;
    const FORCED_BASE_COUNT = FORCED_TARGET_INDEX + 1; // so base[FORCED_TARGET_INDEX] exists
    const FORCED_TAIL_COUNT = TOTAL_ITEMS - FORCED_BASE_COUNT;
    // IMPORTANT: keep this strictly < 0.5 of item spacing (gap between item centers),
    // otherwise the "nearest item to center" could become the next item at the stop point.
    const STOP_OFFSET_RATIO = 0.49;

    // Get the store accessor (don't read the result here - read it inside spin())
    const getForcedResult = () => {
      const forcedResults = useSpinStore.getState().forcedResults;
      return forcedResults.get(slotIndex) ?? null;
    };

    // Item dimensions: 160px item + 20px margin on each side = 200px total per item
    const itemSize = isVertical ? 80 : 160; // Item image size
    const itemMargin = 20; // Margin on each side
    const itemTotalWidth = itemSize + (itemMargin * 2); // 160 + 40 = 200px total
    const itemTotalHeight = itemSize + (itemMargin * 2); // Same for vertical
    const centerOffset = -itemSize / 2;
    // Generate a random item from pack items
    const generateRandomItem = (): PackItem => {
      if (packItems.length === 0) {
        // Fallback if pack has no items
        return {
          id: "",
          image: "",
          name: "",
          price: "",
          probability: "",
          metadata: { probability: 0, normalizedWeight: 0 },
          template: { imageUrl: "", name: "", value: "", description: "" },
        };
      }
      const randomIndex = Math.floor(Math.random() * packItems.length);
      return packItems[randomIndex];
    };

    // Generate items in random order
    const generateItems = (count: number): PackItem[] => {
      const newItems: PackItem[] = [];
      for (let i = 0; i < count; i++) {
        newItems.push(generateRandomItem());
      }
      return newItems;
    };

    // Calculate initial items needed based on container size
    const calculateInitialItems = (): number => {
      if (!wrapperRef.current) return 16; // Default

      if (isVertical) {
        const containerHeight = wrapperRef.current.clientHeight || 400;
        const visibleItems = Math.floor(containerHeight / itemTotalHeight);
        return visibleItems + 12; // visible + 6 on each side
      } else {
        const containerWidth = wrapperRef.current.clientWidth || 1000;
        const visibleItems = Math.floor(containerWidth / itemTotalWidth);
        return visibleItems + 12; // visible + 6 on each side
      }
    };

    // Add items from the right (end of array) when needed
    const addItemsFromRight = (count: number) => {
      setItems((currentItems) => {
        const newItems = generateItems(count);
        return [...currentItems, ...newItems];
      });
    };

    // Preload all unique images from pack items
    const preloadImages = useCallback((itemsToPreload: PackItem[]) => {
      const uniqueImageUrls = new Set<string>();
      itemsToPreload.forEach(item => {
        const imageUrl = item.template?.imageUrl || item.image;
        if (imageUrl && !preloadedImagesRef.current.has(imageUrl)) {
          uniqueImageUrls.add(imageUrl);
        }
      });

      uniqueImageUrls.forEach(url => {
        const img = new window.Image();
        img.src = url;
        preloadedImagesRef.current.add(url);
      });
    }, []);

    // Initialize items - items are already centered by default with absolute positioning.
    // IMPORTANT: do NOT re-initialize just because the parent passed a new pack object
    // with the same id/items (e.g. when swapping drawer sessions after a spin).
    useEffect(() => {
      if (packItems.length > 0) {
        const newItems = generateItems(TOTAL_ITEMS);
        setItems(newItems);
        setHitIndex(null);

        // Preload images for initial items
        preloadImages(newItems);

        // Reset position to 0 - items are centered by default with absolute positioning
        setTranslateX(0);
        setTranslateY(0);
      }
    }, [pack?.id, packItems.length, isVertical, preloadImages]);

    const spin = () => {
      if (isSpinningRef.current || packItems.length === 0) return;

      unlockAudio();
      isSpinningRef.current = true;
      completedTokenRef.current = null;
      spinStartedAtRef.current = typeof performance !== "undefined" ? performance.now() : Date.now();
      setIsSpinning(true);
      setHitIndex(null);
      if (onSpinStart) {
        onSpinStart();
      }

      // Cancel any prior in-flight animation/timeouts (prevents "toast at start" on 2nd spin)
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      rafTickRef.current = 0;
      if (startTimeoutRef.current !== null) {
        window.clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
      if (finishTimeoutRef.current !== null) {
        window.clearTimeout(finishTimeoutRef.current);
        finishTimeoutRef.current = null;
      }
      if (twistFinishTimeoutRef.current !== null) {
        window.clearTimeout(twistFinishTimeoutRef.current);
        twistFinishTimeoutRef.current = null;
      }

      const spinToken = ++spinTokenRef.current;

      // Reset translate to 0
      if (isVertical) setTranslateY(0);
      else setTranslateX(0);
      const startTranslate = 0;

      // Build the reel for this spin.
      // - forced: base + tail, forcedResult at index FORCED_TARGET_INDEX, target index FORCED_TARGET_INDEX, no random offset
      // - not forced: TOTAL_ITEMS random items (simple demo mode)
      // Read forced result NOW (at spin time), not at render time
      const forced = getForcedResult() ?? sampleDemoDrop(packItems);
      const isForced = Boolean(forced);
      
      let updatedItems: PackItem[];
      if (isForced) {
        const base = generateItems(FORCED_BASE_COUNT);
        const tail = generateItems(FORCED_TAIL_COUNT);
        base[FORCED_TARGET_INDEX] = forced!;
        updatedItems = [...base, ...tail];
        preloadImages([forced!]);
        preloadImages(updatedItems);
      } else {
        updatedItems = generateItems(TOTAL_ITEMS);
        preloadImages(updatedItems);
      }

      setItems(updatedItems);

      // Calculate animation parameters
      const totalItemsCount = updatedItems.length;
      const centerIndex = Math.floor(totalItemsCount / 2);
      const targetIndex = isForced ? FORCED_TARGET_INDEX : (totalItemsCount - 5);
      const itemsToMove = targetIndex - centerIndex;
      const moveDistance = itemsToMove * (isVertical ? itemTotalHeight : itemTotalWidth);
      const perfectTargetTranslate = startTranslate - moveDistance;

      const itemSpacing = isVertical ? itemTotalHeight : itemTotalWidth;
      // Stop a bit off-perfect (< half item spacing), then twist-back to perfect center.
      const randomOffset = (Math.random() - 0.5) * 2 * itemSpacing * STOP_OFFSET_RATIO;
      const targetTranslate = perfectTargetTranslate + randomOffset;

      // Store values for animation closure
      const animationStartTranslate = startTranslate;
      const animationTargetTranslate = targetTranslate; // Overshoot position
      const animationUpdatedItems = updatedItems;
      const animationCenterIndex = centerIndex; // Store center index for calculation
      const animationItemSpacing = itemSpacing; // Store item spacing for calculation

      // Start animation after state update
      const forcedTargetIndex = targetIndex;
      const isForcedSpin = isForced;

      const completeOnce = (selectedIndex: number) => {
        // Ensure only the latest spin completes
        if (spinToken !== spinTokenRef.current) {
          console.log(`[SlotMachine ${slotIndex}] completeOnce aborted: stale token`);
          return;
        }

        // Ensure we only call onSpinEnd once per spin token
        if (completedTokenRef.current === spinToken) {
          console.log(`[SlotMachine ${slotIndex}] completeOnce aborted: already completed`);
          return;
        }

        // Ensure we don't "complete" before the animation should be done
        const now = typeof performance !== "undefined" ? performance.now() : Date.now();
        const elapsed = now - spinStartedAtRef.current;
        const minMs = fastOpen ? 650 : 1820; // main animation + twist-back
        if (elapsed < minMs) {
          const remaining = Math.max(0, Math.ceil(minMs - elapsed));
          console.log(`[SlotMachine ${slotIndex}] completeOnce waiting ${remaining}ms more (elapsed: ${elapsed}ms)`);
          finishTimeoutRef.current = window.setTimeout(() => completeOnce(selectedIndex), remaining);
          return;
        }

        console.log(`[SlotMachine ${slotIndex}] completeOnce FIRING onSpinEnd with index ${selectedIndex}, elapsed: ${elapsed}ms`);
        completedTokenRef.current = spinToken;

        if (selectedIndex >= 0 && selectedIndex < animationUpdatedItems.length) {
          setHitIndex(selectedIndex);
          if (winSound === "special") playSpecialWin();
          else playBasicWin();
          onSpinEnd?.(animationUpdatedItems[selectedIndex]);
        }
        isSpinningRef.current = false;
        setIsSpinning(false);
      };

      startTimeoutRef.current = window.setTimeout(() => {
          const animationDuration = fastOpen ? 550 : 1600;
          const startTime = Date.now();
          const initialClosest = Math.max(0, Math.min(animationUpdatedItems.length - 1,
            Math.round(animationCenterIndex - animationStartTranslate / animationItemSpacing)));
          lastCenterIndexRef.current = initialClosest;
          lastTickAtRef.current = 0;

          const animate = () => {
            if (spinToken !== spinTokenRef.current) return;
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentTranslateValue = animationStartTranslate + (animationTargetTranslate - animationStartTranslate) * easedProgress;

            const currentClosest = Math.max(0, Math.min(animationUpdatedItems.length - 1,
              Math.round(animationCenterIndex - currentTranslateValue / animationItemSpacing)));
            if (lastCenterIndexRef.current !== currentClosest) {
              const now = Date.now();
              if (now - lastTickAtRef.current >= 50) {
                playTick();
                lastTickAtRef.current = now;
              }
              lastCenterIndexRef.current = currentClosest;
            }

            // Use direct DOM manipulation for better performance during animation
            if (containerRef.current) {
              if (isVertical) {
                containerRef.current.style.transform = `translateY(${currentTranslateValue}px)`;
              } else {
                containerRef.current.style.transform = `translateX(${currentTranslateValue}px)`;
              }
            }

            // Update React state occasionally so "closest item" scaling can follow during spin
            rafTickRef.current += 1;
            if (rafTickRef.current % 2 === 0) {
              if (isVertical) setTranslateY(currentTranslateValue);
              else setTranslateX(currentTranslateValue);
            }

            if (progress < 1) {
              animationFrameRef.current = requestAnimationFrame(animate);
            } else {
              // Animation complete at overshoot position (e.g., -1966)
              // Determine which item is actually closest to center now.
              // For forced spins we must land exactly on the forced index.
              const currentOvershootPosition = animationTargetTranslate;

              let clampedClosestIndex: number;
              if (isForcedSpin) {
                clampedClosestIndex = Math.max(0, Math.min(forcedTargetIndex, animationUpdatedItems.length - 1));
              } else {
                const closestIndexFloat = animationCenterIndex - (currentOvershootPosition / animationItemSpacing);
                const closestIndex = Math.round(closestIndexFloat);
                clampedClosestIndex = Math.max(0, Math.min(closestIndex, animationUpdatedItems.length - 1));
              }
              
              // Calculate the perfect position to center this closest item
              // Item's offset from center: (closestIndex - centerIndex) * itemSpacing
              const itemOffsetFromCenter = (clampedClosestIndex - animationCenterIndex) * animationItemSpacing;
              // Perfect translate to center this item (negative of offset)
              const perfectPositionForClosestItem = -itemOffsetFromCenter;
              
              // Calculate how much we need to move to perfect position
              const offsetToPerfect = perfectPositionForClosestItem - currentOvershootPosition;
              
              // Now smoothly move to the perfect position for the closest item
              const twistBackStartTime = Date.now();
              const twistBackDuration = fastOpen ? 100 : 220; // 400ms to move to perfect position
              const twistBackStartPosition = currentOvershootPosition; // Current overshoot position
              
              const animateTwistBack = () => {
                if (spinToken !== spinTokenRef.current) return;
                const twistBackElapsed = Date.now() - twistBackStartTime;
                const twistBackProgress = Math.min(twistBackElapsed / twistBackDuration, 1);
                const twistBackEased = 1 - Math.pow(1 - twistBackProgress, 3); // Ease-out cubic
                
                // Move to perfect position for the closest item
                const twistBackCurrentPosition = twistBackStartPosition + (offsetToPerfect * twistBackEased);
                const twistClosest = Math.max(0, Math.min(animationUpdatedItems.length - 1,
                  Math.round(animationCenterIndex - twistBackCurrentPosition / animationItemSpacing)));
                if (lastCenterIndexRef.current !== twistClosest) {
                  const t = Date.now();
                  if (t - lastTickAtRef.current >= 50) {
                    playTick();
                    lastTickAtRef.current = t;
                  }
                  lastCenterIndexRef.current = twistClosest;
                }
                
                // Use direct DOM manipulation for better performance
                if (containerRef.current) {
                  if (isVertical) {
                    containerRef.current.style.transform = `translateY(${twistBackCurrentPosition}px)`;
                  } else {
                    containerRef.current.style.transform = `translateX(${twistBackCurrentPosition}px)`;
                  }
                }

                // Keep state in sync (so scaling follows the moving center)
                rafTickRef.current += 1;
                if (rafTickRef.current % 2 === 0) {
                  if (isVertical) setTranslateY(twistBackCurrentPosition);
                  else setTranslateX(twistBackCurrentPosition);
                }
                
                if (twistBackProgress < 1) {
                  animationFrameRef.current = requestAnimationFrame(animateTwistBack);
                } else {
                  // Sync state with final position
                  if (isVertical) {
                    setTranslateY(twistBackCurrentPosition);
                  } else {
                    setTranslateX(twistBackCurrentPosition);
                  }
                  // Twist back animation complete - now at perfect position for the closest item
                  twistFinishTimeoutRef.current = window.setTimeout(() => {
                    completeOnce(clampedClosestIndex);
                  }, 50);
                }
              };
              
              animationFrameRef.current = requestAnimationFrame(animateTwistBack);
            }
          };

          animationFrameRef.current = requestAnimationFrame(animate);
        }, 0);
    };

    // Cleanup animation frame on unmount
    useEffect(() => {
      return () => {
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (startTimeoutRef.current !== null) {
          window.clearTimeout(startTimeoutRef.current);
        }
        if (finishTimeoutRef.current !== null) {
          window.clearTimeout(finishTimeoutRef.current);
        }
        if (twistFinishTimeoutRef.current !== null) {
          window.clearTimeout(twistFinishTimeoutRef.current);
        }
        completedTokenRef.current = null;
        isSpinningRef.current = false;
      };
    }, []);

    // Expose spin function via ref
    useImperativeHandle(ref, () => ({
      spin: () => spin(),
    }));

    // Calculate translate position for each item based on its index
    // Center item is at position 0, others are offset by their distance from center
    const getItemPosition = (index: number, centerIndex: number) => {
      if (isVertical) {
        const offset = (index - centerIndex) * itemTotalHeight;
        return offset;
      } else {
        const offset = (index - centerIndex) * itemTotalWidth;
        return offset;
      }
    };

    // Calculate which item is closest to center based on current translate (memoized)
    const closestToCenterIndex = useMemo(() => {
      if (items.length === 0) return 0;
      const centerIndex = Math.floor(items.length / 2);
      const currentTranslate = isVertical ? translateY : translateX;
      const itemSpacing = isVertical ? itemTotalHeight : itemTotalWidth;
      
      // Calculate which index should be at center: centerIndex - (translate / itemSpacing)
      // "Nearest item" behavior: switches only after passing half of the item spacing (gap).
      const closestIndexFloat = centerIndex - currentTranslate / itemSpacing;
      const closestIndex = Math.round(closestIndexFloat);
      
      // Clamp to valid range
      return Math.max(0, Math.min(closestIndex, items.length - 1));
    }, [items.length, translateY, translateX, isVertical, itemTotalHeight, itemTotalWidth]);

    // Tick sound when an item passes center while spinning
    useEffect(() => {
      if (!isSpinning) {
        lastCenterIndexRef.current = null;
        return;
      }
      const prev = lastCenterIndexRef.current;
      if (prev !== null && prev !== closestToCenterIndex) {
        playTick();
      }
      lastCenterIndexRef.current = closestToCenterIndex;
    }, [isSpinning, closestToCenterIndex]);

    // Memoize item rendering to prevent unnecessary re-renders
    const renderItem = useCallback((item: PackItem, index: number) => {
      // Calculate center index (middle of items array)
      const centerIndex = Math.floor(items.length / 2);
      const position = getItemPosition(index, centerIndex);

      // This item is the center item if it's closest to center
      const isCenterItem = index === closestToCenterIndex;
      const scale = isCenterItem ? 1.5 : 1;

      // Calculate probability for color class
      const probability = item.metadata?.probability ?? (parseFloat(item.probability || "0") / 100);
      const probabilityPercent = probability * 100;
      const colorClass = probabilityPercent < 0.5 ? 'bg-pack-gold' : probabilityPercent < 1 ? 'bg-pack-red' : probabilityPercent < 2 ? 'bg-pack-pink' : probabilityPercent < 4 ? 'bg-pack-purple' : probabilityPercent <= 5 ? 'bg-pack-blue' : 'bg-pack-common';

      const imageUrl =
        item.template?.imageUrl ||
        item.image ||
        (item as PackItem & { imageUrl?: string }).imageUrl ||
        "/placeholder.png";
      const showFallback = failedImageUrls.has(imageUrl);

      // Show the price under the item the reel stopped on
      const rawPrice = String(item.price ?? "").trim();
      const priceText = rawPrice ? (rawPrice.startsWith("$") ? rawPrice : `$${rawPrice}`) : "";
      const showPrice = !isSpinning && hitIndex === index && priceText !== "";

      return (
        <div data-reel-item="true"
          key={`item-${index}-${item.template?.name || item.name || index}`}
          className="absolute flex items-center justify-center"
          style={{
            width: `${itemSize}px`,
            height: `${itemSize}px`,
            minWidth: `${itemSize}px`,
            minHeight: `${itemSize}px`,
            maxWidth: `${itemSize}px`,
            maxHeight: `${itemSize}px`,
            left: "50%",
            top: "50%",
            transform: isVertical
              ? `translate(${centerOffset}px, ${position + centerOffset}px)`
              : `translate(${position + centerOffset}px, ${centerOffset}px)`,
          }}
        >
          <div data-reel-art="true"
            className="relative flex items-center justify-center"
            style={{
              width: "55%",
              height: "55%",
              transform: `scale(${scale})`,
              transition: "transform 80ms linear",
            }}
          >
            <div className={cn(`flex items-center justify-center h-1/2 w-1/2
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 aspect-square duration-200
             rounded-full opacity-90 filter blur-[25px]`, colorClass)}>
            </div>
            {showFallback ? (
              <div
                className="bg-background-elevated rounded-lg flex items-center justify-center text-text-muted text-xs z-30"
                style={{ width: `${itemSize}px`, height: `${itemSize}px` }}
                title={item.template?.name || item.name || "Item"}
              >
                ?
              </div>
            ) : (
              <img
                src={imageUrl}
                alt={item.template?.name || item.name || "Item"}
                width={itemSize}
                height={itemSize}
                className="object-contain z-30"
                loading="eager"
                style={{ width: "100%", height: "100%", display: "block" }}
                decoding="async"
                onError={() => {
                  setFailedImageUrls((prev) => new Set(prev).add(imageUrl));
                }}
              />
            )}
          </div>
          {showPrice && (
            <div data-drop-price="true"
              className="absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ top: "92%", marginTop: 6 }}
            >
              {priceText}
            </div>
          )}
        </div>
      );
    }, [items.length, isVertical, itemTotalHeight, itemTotalWidth, closestToCenterIndex, itemSize, centerOffset, failedImageUrls, isSpinning, hitIndex]);

    return (
      <div data-spinning={isSpinning} data-reel-machine={isVertical ? "vertical" : "horizontal"}
        ref={wrapperRef}
        className={`relative ${isVertical ? "w-20 h-[450px]" : " w-full h-[160px]"}`}
      ><i className="gxReelTarget" aria-hidden="true"/>
        {/* Center indicator */}
        {/* {isVertical ? (
          // Horizontal line for vertical spinning
          <div className="absolute left-0 right-0 top-1/2 h-1 bg-red-500 z-20 transform -translate-y-1/2 shadow-lg shadow-red-500/50">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white"></div>
            </div>
          </div>
        ) : (
          // Vertical line for horizontal spinning
          <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-red-500 z-20 transform -translate-x-1/2 shadow-lg shadow-red-500/50">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white"></div>
            </div>
          </div>
        )} */}

        {/* Gradient overlays for fade effect */}
        {isVertical ? (
          <>
            <div className="absolute top-0 left-0 right-0 h-32 bg-linear-to-b from-background-sunken to-transparent z-10"></div>
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-linear-to-t from-background-sunken to-transparent z-10"></div>
          </>
        ) : (
          <>
            <div className="absolute top-0 bottom-0 left-0 w-32 bg-linear-to-r from-background-sunken to-transparent z-10"></div>
            <div className="absolute top-0 bottom-0 right-0 w-32 bg-linear-to-l from-background-sunken to-transparent z-10"></div>
          </>
        )}


        {/* Items container */}
        {items.length > 0 ? (
          <div data-reel-track="true"
            ref={containerRef}
            className="relative w-full h-full"
            style={{
              transform: isVertical ? `translateY(${translateY}px)` : `translateX(${translateX}px)`,
              transition: isSpinning ? "none" : "transform 800ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              willChange: isSpinning ? "transform" : "auto",
            }}
          >
            {items.map((item, index) => renderItem(item, index))}
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <p className="text-text-muted">Unable to load items for this case.</p>
          </div>
        )}
      </div>
    );
  }
);

SlotMachine.displayName = "SlotMachine";

export default SlotMachine;
