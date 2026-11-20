"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button as ButtonUI } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { Button } from "@heroui/react";
import { type PackDetails as APIPackDetails } from "@/lib/api/packs";
import { useAuthStore } from "@/store/auth.store";
import { cleanNumber, formatCurrency } from "@/lib/utils/numbers";



interface PackDetailsProps {
  selectedPacks: APIPackDetails[];
  quantity: number;
  onQuantityChange: (qty: number) => void;
  onOpenPacks: () => void;
  onDemoSpin: () => void;
  openLoopRemaining?: number;
  openLoopTotal?: number;
  isOpening?: boolean;
}

export default function PackDetails({
  selectedPacks,
  quantity,
  onQuantityChange,
  onOpenPacks,
  onDemoSpin,
  openLoopRemaining = 0,
  openLoopTotal = 0,
  isOpening = false,
}: PackDetailsProps) {
  const isAuthenticated = useAuthStore((s) => !!s.token);

  const totalPacks = selectedPacks.length;
  const totalPrice = selectedPacks.reduce((sum, p) => {
    return sum + parseFloat(p.price.replace("$", "")) * quantity;
  }, 0);

  const decreaseQuantity = () => {
    if (quantity > 1) {
      onQuantityChange(quantity - 1);
    }
  };

  const increaseQuantity = () => {
    if (quantity < 15) {
      onQuantityChange(quantity + 1);
    }
  };

  if (totalPacks === 0) {
    return null;
  }

  return (
    <div data-pack-controls="true" className="relative flex flex-row justify-between items-center gap-[53px] w-full max-w-4xl mx-auto px-4">
      {/* Quantity Selector */}
      <div data-pack-quantity="true" className="flex flex-row items-center gap-5 px-0.5 py-2 border border-dashed border-[rgba(63,71,84,0.24)] rounded-lg h-9 w-[116px] shrink-0">
        <Button
          aria-label="Decrease case quantity"
          onClick={decreaseQuantity}
          disabled={quantity <= 1 || openLoopTotal > 0}
          className="flex items-center justify-center min-w-0 w-8 h-8 bg-[rgba(63,71,84,0.24)] rounded-md shrink-0 hover:bg-[rgba(63,71,84,0.32)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="minus" className="w-4 h-4" />
        </Button>
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white flex-1 text-center">
          {openLoopTotal > 0 ? `${openLoopTotal - openLoopRemaining}/${openLoopTotal}` : quantity}
        </span>
        <Button
          aria-label="Increase case quantity"
          onClick={increaseQuantity}
          disabled={quantity >= 15 || openLoopTotal > 0}
          className="flex items-center justify-center min-w-0 w-8 h-8 bg-[rgba(63,71,84,0.24)] rounded-md shrink-0 hover:bg-[rgba(63,71,84,0.32)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="plus" className="w-4 h-4" />
        </Button>
      </div>

      {/* Demo Spin Button */}
      <ButtonUI data-pack-demo="true"
        variant="secondary"
        size="sm"
        onClick={onDemoSpin}
        className="h-9 px-3 bg-[rgba(63,71,84,0.24)] hover:bg-[rgba(63,71,84,0.32)] gap-1 shrink-0"
      >
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium">Demo Spin</span>
        <Icon name="dice-faces-05" className="w-4 h-4" />
      </ButtonUI>

      {/* Open Pack Button - Centered */}
      <ButtonUI data-pack-open="true"
        variant="primary"
        size="sm"
        onClick={onOpenPacks}
        disabled={!isAuthenticated || isOpening}
        className="h-9 px-5 absolute left-1/2 -translate-x-1/2 shrink-0"
      >
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium">
          {openLoopTotal > 0 ? `Opening ${openLoopTotal - openLoopRemaining}/${openLoopTotal}…` : `Open for $${formatCurrency(totalPrice)}`}
        </span>
      </ButtonUI>
    </div>
  );
}
