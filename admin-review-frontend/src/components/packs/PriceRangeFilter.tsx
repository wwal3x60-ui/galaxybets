"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils/cn";
// Native range inputs give each price control an explicit accessible label.

export default function PriceRangeFilter({ min, max, onChange }: { min: number, max: number, onChange: (value: [number, number]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [minValue, setMinValue] = useState(min);
  const [maxValue, setMaxValue] = useState(max);
  const [minInput, setMinInput] = useState(min);
  const [maxInput, setMaxInput] = useState(max);
  const [value, setValue] = useState<[number, number]>([min, max]);

  useEffect(() => {
    setMinValue(min);
    setMaxValue(max);
    setMinInput(min);
    setMaxInput(max);
    setValue([min, max]);
  }, [min, max]);

  // Apply filter to parent only when user finishes (not on every slider tick)
  const applyFilter = useCallback(
    (val: [number, number]) => {
      onChange(val);
    },
    [onChange]
  );

  const clamp = (n: number, minN: number, maxN: number) => Math.max(minN, Math.min(maxN, n));


  useEffect(() => {
    const a = Number.isFinite(minInput) ? minInput : min;
    const b = Number.isFinite(maxInput) ? maxInput : max;
    const nextMin = clamp(Math.min(a, b), min, max);
    const nextMax = clamp(Math.max(a, b), min, max);
    const next: [number, number] = [nextMin, nextMax];
    applyFilter(next);

    setValue(next);

  }, [minInput, maxInput]);

  const handleCloseDropdown = () => {
    applyFilter(value);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex flex-row justify-between items-center gap-4 px-3 py-0.5 h-8",
          "bg-[rgba(63,71,84,0.12)] rounded-full",
          "text-sm leading-[15px] tracking-[-0.02em] font-medium",
          "text-white hover:bg-[rgba(63,71,84,0.24)] transition-colors",
          "w-full lg:min-w-[194px]"
        )}
      >
        <div className="flex flex-row items-center gap-1 flex-1">
          <Icon name="arrange" className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">Price Range</span>
        </div>
        <Icon name="chevron-down" className="w-4 h-4 shrink-0" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={handleCloseDropdown}
          />
          <div className="absolute top-full left-0 mt-2 z-20 w-full sm:w-auto sm:min-w-[194px] bg-background-elevated border border-[rgba(63,71,84,0.24)] rounded-lg shadow-[0px_0px_20px_4px_rgba(0,0,0,0.4)] px-2 pt-3 pb-2">
            {/* Range Slider */}
            <div className="flex flex-col items-start gap-3 w-full sm:w-[178px]">
              {/* Slider Track */}
              <div className="flex w-full flex-col gap-2" role="group" aria-label="Case price range">
                <label className="flex w-full flex-col gap-1 text-xs text-white/70">Minimum price
                  <input type="range" aria-label="Minimum case price (USD)" min={min} max={max} step={10} value={value[0]} onChange={e => setMinInput(Number(e.target.value))} className="w-full accent-violet-400"/>
                </label>
                <label className="flex w-full flex-col gap-1 text-xs text-white/70">Maximum price
                  <input type="range" aria-label="Maximum case price (USD)" min={min} max={max} step={10} value={value[1]} onChange={e => setMaxInput(Number(e.target.value))} className="w-full accent-violet-400"/>
                </label>
              </div>

              {/* Input Fields */}
              <div className="flex flex-row justify-between items-center w-full">
                <div className="flex flex-row justify-center items-center px-2.5 py-2 h-[31px] bg-[rgba(63,71,84,0.24)] rounded-md w-[60px] shrink-0">
                  <input
                    type="text"
                    aria-label="Minimum case price (USD)"
                    inputMode="decimal"
                    value={minInput}
                    onChange={(e) => setMinInput(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-transparent border-none outline-none text-sm leading-[15px] tracking-[-0.02em] font-medium text-white/92 text-center"
                  />
                </div>
                <div className="flex flex-row justify-center items-center px-2.5 py-2 h-[31px] bg-[rgba(63,71,84,0.24)] rounded-md w-[60px] shrink-0">
                  <input
                    type="text"
                    aria-label="Maximum case price (USD)"
                    inputMode="decimal"
                    value={maxInput}
                    onChange={(e) => setMaxInput(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-transparent border-none outline-none text-sm leading-[15px] tracking-[-0.02em] font-medium text-white/92 text-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
