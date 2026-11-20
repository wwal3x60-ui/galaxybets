"use client";

import { useState } from "react";
import { Image } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";

interface PackHeroProps {
  items: Array<{
    image: string;
    name: string;
    price: string;
  }>;
}

export default function PackHero({ items }: PackHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(Math.floor(items.length / 2));

  const nextItem = () => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  };

  const prevItem = () => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const currentItem = items[currentIndex];

  return (
    <div className="relative w-full h-[400px] bg-background-sunken border-x border-[rgba(63,71,84,0.24)] flex items-center justify-center overflow-hidden">
      {/* Navigation Arrows */}
      <button
        onClick={prevItem}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center bg-background-elevated/80 hover:bg-background-elevated rounded-full transition-colors"
      >
        <Icon name="arrow-left" className="w-4 h-4" />
      </button>
      <button
        onClick={nextItem}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 flex items-center justify-center bg-background-elevated/80 hover:bg-background-elevated rounded-full transition-colors rotate-180"
      >
        <Icon name="arrow-left" className="w-4 h-4" />
      </button>

      {/* Items Carousel */}
      <div className="flex flex-row items-center gap-[60px] overflow-x-auto scrollbar-hide px-4">
        {/* Left items */}
        {items.slice(Math.max(0, currentIndex - 3), currentIndex).map((item, idx) => (
          <div key={`left-${idx}`} className="flex flex-col items-center shrink-0 opacity-50">
            <Image src={item.image} alt={item.name} width={48} height={90} className="object-contain" />
          </div>
        ))}

        {/* Current Item (Center) */}
        <div className="flex flex-col items-center gap-4 shrink-0">
          <div className="relative">
            <Image src={currentItem.image} alt={currentItem.name} width={48} height={90} className="object-contain" />
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-11 bg-white transform rotate-[-15.61deg]" />
          </div>
          <div className="flex flex-col items-center gap-4 w-[160px]">
            <div className="flex flex-row justify-between items-center w-full h-3">
              <div className="w-3 h-3 border-t border-l border-text-muted" />
              <div className="w-3 h-3 border-t border-l border-text-muted rotate-180" />
            </div>
            <div className="flex flex-col items-center gap-4 w-[109px]">
              <Image src={currentItem.image} alt={currentItem.name} width={48} height={90} className="object-contain" />
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-text-muted text-center">
                  {currentItem.name}
                </p>
                <p className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  {currentItem.price}
                </p>
              </div>
            </div>
            <div className="flex flex-row justify-between items-center w-full h-3 rotate-180">
              <div className="w-3 h-3 border-t border-l border-text-muted" />
              <div className="w-3 h-3 border-t border-l border-text-muted rotate-180" />
            </div>
          </div>
        </div>

        {/* Right items */}
        {items.slice(currentIndex + 1, Math.min(items.length, currentIndex + 4)).map((item, idx) => (
          <div key={`right-${idx}`} className="flex flex-col items-center shrink-0 opacity-50">
            <Image src={item.image} alt={item.name} width={48} height={90} className="object-contain" />
          </div>
        ))}
      </div>
    </div>
  );
}
