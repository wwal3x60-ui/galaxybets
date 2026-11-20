"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils/cn";

interface FilterButtonProps {
  icon: string;
  label: string;
  options?: string[];
  defaultOption?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export default function FilterButton({ 
  icon, 
  label, 
  options = [],
  defaultOption,
  value,
  onChange
}: FilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState(value || defaultOption || label);
  
  // Sync with external value
  useEffect(() => {
    if (value !== undefined) {
      setSelectedOption(value);
    }
  }, [value]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex flex-row justify-between items-center gap-2 px-3 py-0.5 h-8",
          "bg-[rgba(63,71,84,0.12)] rounded-full",
          "text-sm leading-[15px] tracking-[-0.02em] font-medium",
          "text-white hover:bg-[rgba(63,71,84,0.24)] transition-colors",
          "w-full lg:min-w-[194px]"
        )}
      >
        <div className="flex flex-row items-center gap-1 flex-1">
          <Icon name={icon} className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">{selectedOption}</span>
        </div>
        <Icon name="chevron-down" className="w-4 h-4 shrink-0" />
      </button>

      {isOpen && options.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 z-20 w-full sm:w-auto sm:min-w-[194px] bg-background-elevated border border-[rgba(63,71,84,0.24)] rounded-lg shadow-lg overflow-hidden">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  setSelectedOption(option);
                  onChange?.(option);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm leading-[15px] tracking-[-0.02em] font-medium",
                  "text-white hover:bg-[rgba(63,71,84,0.12)] transition-colors",
                  selectedOption === option && "bg-[rgba(63,71,84,0.24)]"
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
