"use client";

import { useState, useEffect, useMemo, useCallback, memo, useRef } from "react";
import { Button, Input, Image, Select, SelectItem } from "@heroui/react";
import { addToast } from "@/lib/toast";
import { Icon } from "@/components/ui/Icon";
import {
  getPackImages,
  getPackItemOptions,
  createPack,
  type PackImage,
  type PackItemOption,
  type CreatePackData,
} from "@/lib/api/create-pack";
import type { Selection } from "@heroui/react";
import { useRouter } from "next/navigation";
import { formatPriceDisplay } from "@/lib/utils/format";
import { cleanNumber, formatCurrency, formatDecimal, formatPercent } from "@/lib/utils/numbers";
import { useAuthStore } from "@/store/auth.store";

type Step = 1 | 2;

/** Mirrors backend AdminService EV validation: EV_user ≤ P × (1 − m), prob in [0.0001, 1] */
export type PackEvValidationStatus =
  | { valid: true; evUser: number; maxEvUser: number; message: string }
  | { valid: false; evUser?: number; maxEvUser?: number; message: string };

function validatePackEv(
  selectedItems: SelectedItem[],
  computedPackPrice: number,
  commissionPct: number
): PackEvValidationStatus {
  if (selectedItems.length < 2) {
    return { valid: false, message: "Add at least 2 items" };
  }
  const totalDropChance = selectedItems.reduce((s, i) => s + i.dropChance, 0);
  if (Math.abs(totalDropChance - 100) > 0.0001) {
    return { valid: false, message: "Total drop chance must equal 100%" };
  }
  const platformMargin = commissionPct / 100;
  const maxEvUser = cleanNumber(computedPackPrice, 6);
  let evUser = 0;
  for (const item of selectedItems) {
    const prob = item.dropChance / 100;
    if (prob < 0 || prob > 1) {
      return { valid: false, message: `Drop chance for "${item.name}" must be between 0 and 100%` };
    }
    if (prob < 0.0001) {
      return {
        valid: false,
        evUser,
        maxEvUser,
        message: `Each item must have at least 0.01% drop chance. "${item.name}" is too low.`,
      };
    }
    const value = parseFloat(item.price);
    evUser += Number.isFinite(value) ? prob * value : 0;
  }
  evUser = cleanNumber(evUser, 6);
  if (evUser > maxEvUser + 0.000001) {
    return {
      valid: false,
      evUser,
      maxEvUser,
      message: `Expected value ($${formatPriceDisplay(evUser)}) exceeds maximum ($${formatPriceDisplay(maxEvUser)}). Lower drop chances or item values to meet margin.`,
    };
  }
  return {
    valid: true,
    evUser,
    maxEvUser,
    message: `Valid — EV within limit ($${formatPriceDisplay(evUser)} ≤ $${formatPriceDisplay(maxEvUser)})`,
  };
}

interface SelectedItem extends PackItemOption {
  dropChance: number;
}

interface SelectedItemCardProps {
  item: SelectedItem;
  onRemove: (item: PackItemOption) => void;
  onDropChanceChange: (itemId: string, value: number) => void;
}

const SelectedItemCard = memo(function SelectedItemCard({
  item,
  onRemove,
  onDropChanceChange,
}: SelectedItemCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(formatDecimal(item.dropChance, 2));
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Update edit value when item.dropChance changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(formatDecimal(item.dropChance, 2));
    }
  }, [item.dropChance, isEditing]);

  // Handlers don't need useCallback since component is already memoized
  const handleDecrease = () => {
    onDropChanceChange(item.id, Math.max(0, item.dropChance - 0.01));
  };

  const handleIncrease = () => {
    onDropChanceChange(item.id, Math.min(100, item.dropChance + 0.01));
  };

  const handleRemove = () => {
    onRemove(item);
  };

  const handleInputChange = (value: string) => {
    // Remove % sign if present and allow only numbers and decimal point
    const cleaned = value.replace(/[^0-9.]/g, "");
    setEditValue(cleaned);
  };

  const handleInputBlur = () => {
    setIsEditing(false);
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue)) {
      const clampedValue = Math.max(0, Math.min(100, numValue));
      onDropChanceChange(item.id, clampedValue);
      setEditValue(formatDecimal(clampedValue, 2));
    } else {
      setEditValue(formatDecimal(item.dropChance, 2));
    }
  };

  const handleInputFocus = () => {
    setIsEditing(true);
    // Select all text on focus for easy editing
    setTimeout(() => {
      inputRef.current?.select();
    }, 0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-[127px] h-[127px] flex flex-col items-start gap-2">
      {/* Item Card */}
      <div className="relative flex-col w-[127px] py-4 bg-[rgba(63,71,84,0.12)] rounded-lg flex items-center justify-center">
        <Image
          src={item.image}
          alt={item.name}
          width={45}
          className="object-contain"
        />

        {/* Close Button */}
        <Button
          onPress={handleRemove}
          className="absolute right-[4px] top-[4px] w-5 h-5 min-w-0 p-0 bg-transparent hover:bg-[rgba(63,71,84,0.24)] rounded-md"
        >
          <Icon name="x" className="w-4 h-4 text-[#6c6c71]" />
        </Button>

        {/* Item Name and Price */}
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs leading-[13px] tracking-[-0.02em] font-medium text-[#6c6c71] text-center whitespace-nowrap truncate">
            {item.name}
          </span>
          <span className="text-xs leading-[13px] tracking-[-0.02em] font-medium text-white text-center">
            ${formatPriceDisplay(item.price)}
          </span>
        </div>
      </div>

      {/* Percentage Control */}
      <div className="h-7 border border-dashed border-[rgba(63,71,84,0.24)] rounded-lg flex flex-row items-center justify-between px-0.5">
        {/* Minus Button */}
        <Button
          onPress={handleDecrease}
          className="w-6 h-6 min-w-0 p-0 bg-[rgba(63,71,84,0.24)] rounded-md shrink-0"
        >
          <Icon name="minus" className="w-4 h-4 text-[#6c6c71]" />
        </Button>

        {/* Percentage Value - Editable Input */}
        <div className="flex items-center justify-center gap-0 flex-1">
          <Input
            type="text"
            value={editValue}
            onValueChange={handleInputChange}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            onKeyDown={handleInputKeyDown}
            endContent="%"
            classNames={{
              inputWrapper: "py-0 bg-transparent text-white",
            }}
          />
        </div>

        {/* Plus Button */}
        <Button
          onPress={handleIncrease}
          className="w-6 h-6 min-w-0 p-0 bg-[rgba(63,71,84,0.24)] rounded-md shrink-0"
        >
          <Icon name="plus" className="w-4 h-4 text-[#6c6c71]" />
        </Button>
      </div>
    </div>
  );
});

export function CreatePackPage() {
  const [step, setStep] = useState<Step>(1);
  const [packName, setPackName] = useState("");
  const [commission, setCommission] = useState<Selection>(new Set([]));
  const [selectedPackImage, setSelectedPackImage] = useState<string | null>(null);
  const [packImages, setPackImages] = useState<PackImage[]>([]);
  const [packItemOptions, setPackItemOptions] = useState<PackItemOption[]>([]);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const commissionOptionsList = [
    { key: "0.5", label: "0.5%" },
    { key: "1", label: "1%" },
    { key: "1.5", label: "1.5%" },
    { key: "2", label: "2%" },
    { key: "2.5", label: "2.5%" },
    { key: "3", label: "3%" },
  ];

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
      addToast({
        title: "Please login to create a case",
        description: "You need to be logged in to create a case",
        color: "warning",
      });
    }
  }, [isAuthenticated]);

  // Fetch pack images on mount
  useEffect(() => {
    const fetchPackImages = async () => {
      setIsLoading(true);
      try {
        const images = await getPackImages();
        setPackImages(images);
      } catch (error) {
        console.error("Error fetching case images:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPackImages();
  }, []);

  // Fetch pack item options when filters change
  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true);
      try {
        const items = await getPackItemOptions({
          search: searchQuery || undefined,
          maxPrice: maxPrice,
        });
        setPackItemOptions(items);
      } catch (error) {
        console.error("Error fetching case items:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (step === 2) {
      fetchItems();
    }
  }, [step, searchQuery, maxPrice]);

  // Calculate total drop chance percentage
  const totalDropChance = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.dropChance, 0);
  }, [selectedItems]);

  // Calculate computed pack price
  const computedPackPrice = useMemo(() => {
    if (selectedItems.length === 0) return 0;
    const totalValue = selectedItems.reduce((sum, item) => {
      const price = parseFloat(item.price);
      return sum + (Number.isFinite(price) ? cleanNumber(price * (item.dropChance / 100), 4) : 0);
    }, 0);
    const evUser = cleanNumber(totalValue, 4);
    const platformMargin = parseFloat(process.env.NEXT_PUBLIC_PLATFORM_MARGIN || "0.08"); // 8%
    const creatorCut = Number(Array.from(commission)[0]) / 100;  


    return Number((evUser / (1 - platformMargin - creatorCut)).toFixed(3));;
  }, [selectedItems]);

  // Calculate earnings per pack (based on pack price, not computed price)
  // For now, using a placeholder calculation - this should be based on the actual pack price
  const earningsPerPack = useMemo(() => {
    // TODO: This should be calculated based on the actual pack price when it's set
    // For now, using computed pack price as a placeholder
    if (computedPackPrice === 0) return 0;
    return computedPackPrice * (Number(Array.from(commission)[0]) / 100);
  }, [computedPackPrice, commission]);

  // EV validation (mirrors backend: EV_user ≤ P × (1 − m), prob ≥ 0.01%)
  const evValidation = useMemo(() => {
    const commissionNum = Number(Array.from(commission)[0]);
    return validatePackEv(selectedItems, computedPackPrice, Number.isFinite(commissionNum) ? commissionNum : 0);
  }, [selectedItems, computedPackPrice, commission]);

  const handleProceedToStep2 = () => {
    if (!packName.trim() || !selectedPackImage) return;
    setStep(2);
  };

  const handleBackToStep1 = () => {
    setStep(1);
  };

  const handleItemToggle = useCallback((item: PackItemOption) => {
    setSelectedItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === item.id);
      if (existingIndex >= 0) {
        // Remove item
        return prev.filter((i) => i.id !== item.id);
      } else {
        // Add item with default drop chance
        if (prev.length >= 50) return prev; // Max 50 items
        return [...prev, { ...item, dropChance: 0 }];
      }
    });
  }, []);

  const handleDropChanceChange = useCallback((itemId: string, value: number) => {
    setSelectedItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, dropChance: Math.max(0, Math.min(100, value)) } : item
      )
    );
  }, []);

  const handleCreatePack = async () => {
    if (selectedItems.length < 2 || totalDropChance !== 100) return;
    if (selectedItems.some((i) => i.dropChance <= 0)) return;

    const packData: CreatePackData = {
      name: packName,
      commission: Number(Array.from(commission)[0]),
      imageUrl: selectedPackImage!,
      computedPackPrice: Number(computedPackPrice.toFixed(2)),
      items: selectedItems.map((item) => ({
        itemId: item.id,
        dropChance: item.dropChance,
      })),
    };

    try {
      setIsLoading(true);
      await createPack(packData);
      // TODO: Show success message and navigate to pack page
      console.log("Case created successfully!");
      addToast({
        title: "Case created successfully!",
        description: "Please wait while admin approves your case.",
        color: "success",
      })
      router.push(`/cases/`);
    } catch (error: any) {
      console.error("Error creating case:", error);
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to create case';
      addToast({
        title: "Error creating case:",
        description: errorMessage,
        color: "danger",
      })
      // TODO: Show error message
    } finally {
      setIsLoading(false);
    }
  };

  const commissionOptions = [0.5, 1, 1.5, 2, 2.5, 3];

  return (
    <div className="flex flex-col items-center w-full pt-20 pb-10 min-h-screen px-4 md:px-0 max-w-4xl mx-auto gap-5">
      {/* Header */}
      <div className="flex flex-row justify-between items-center w-full">
        <h1 className="text-xl leading-[22px] tracking-[-0.02em] font-medium text-white">
          Create a case
        </h1>
        {/* Step Indicator */}
        <div className="flex flex-row items-center gap-5">
          <div
            className={`flex flex-row items-center px-3 py-1 gap-1 rounded-full ${step === 1
              ? "bg-[rgba(0,62,130,0.12)] border border-[#515256]"
              : "bg-transparent"
              }`}
          >
            <span
              className={`text-sm leading-[15px] tracking-[-0.02em] font-medium ${step === 1 ? "text-white" : "text-[#6c6c71]"
                }`}
            >
              Enter Case Details
            </span>
            {step === 1 && <Icon name="chevron-right" className="w-4 h-4 text-[#6c6c71]" />}
          </div>
          <div
            className={`flex flex-row items-center px-3 py-1 gap-1 rounded-full ${step === 2
              ? "bg-[rgba(0,62,130,0.12)] border border-[#515256]"
              : "bg-transparent"
              }`}
          >
            <span
              className={`text-sm leading-[15px] tracking-[-0.02em] font-medium ${step === 2 ? "text-white" : "text-[#6c6c71]"
                }`}
            >
              Choose Case Items
            </span>
          </div>
        </div>
      </div>

      {/* Step 1: Enter Pack Details */}
      {step === 1 && (
        <>
          {/* Pack Details Form */}
          <div className="w-full bg-[#1e1f23] rounded-[10px] p-5 flex flex-col md:flex-row items-start md:items-center gap-10">
            {/* Pack Name */}
            <div className="flex flex-col items-start gap-3 flex-1">
              <label className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                Case Name
              </label>
              <Input
                type="text"
                value={packName}
                onValueChange={setPackName}
                placeholder="Enter case name"
                classNames={{
                  inputWrapper: "bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-md h-9",
                  input: "text-sm leading-[15px] tracking-[-0.02em] font-medium text-white",
                }}
              />
              <p className="text-xs leading-[13px] tracking-[-0.02em] font-medium text-[#6c6c71]">
                Case name must not include special characters, profanities or slurs
              </p>
            </div>

            {/* Set Pack Commission */}
            <div className="flex flex-col items-start gap-3 flex-1 relative">
              <span className="absolute top-0 right-0 text-xs leading-[13px] tracking-[-0.02em] font-medium text-[#6c6c71]">
                (0.5% - 3%)
              </span>
              <Select
                label="Set Case Commission"
                labelPlacement="outside"
                selectedKeys={commission}
                onSelectionChange={setCommission}
                classNames={{
                  trigger: "bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-md h-9 min-w-[360px]",
                  value: "text-sm leading-[15px] tracking-[-0.02em] font-medium text-white",
                }}
              >
                {commissionOptionsList.map((opt) => (
                  <SelectItem key={opt.key}>{opt.label}</SelectItem>
                ))}
              </Select>
              <p className="text-xs leading-[13px] tracking-[-0.02em] font-medium text-[#6c6c71]">
                You will receive ${formatCurrency(earningsPerPack)} for each case open
              </p>
            </div>
          </div>

          {/* Choose Pack Image */}
          <div className="w-full bg-[#1e1f23] rounded-[10px] p-5">
            <h2 className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white mb-5">
              Choose Case Image
            </h2>

            <div className="flex flex-row items-start gap-10">
              {/* Selected Pack Image Preview */}
              <div className="w-[200px] h-[311.71px] border border-dashed border-[rgba(63,71,84,0.24)] rounded-[11.43px] flex items-center justify-center shrink-0">
                {selectedPackImage ? (
                  <div className="w-[184px] h-[295.71px] relative p-2">
                    <Image
                      src={selectedPackImage}
                      alt="Selected case"
                      width={184}
                      height={295.71}
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-[#6c6c71]">Select an image</div>
                )}
              </div>

              {/* Pack Image Grid */}
              <div className="grid grid-cols-5 gap-2 flex-1">
                {packImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedPackImage(img.image)}
                    className={`w-[101.6px] h-[151.81px] rounded-[5.91px] overflow-hidden ${selectedPackImage === img.image
                      ? "bg-[rgba(63,71,84,0.24)] border border-[rgba(63,71,84,0.24)]"
                      : "bg-transparent"
                      }`}
                  >
                    <div className="w-[87.12px] h-[140.02px] mx-auto mt-[5.9px]">
                      <Image
                        src={img.image}
                        alt="Case image"
                        width={87.12}
                        height={140.02}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-row items-center gap-3 w-full justify-end">
            <Button
              onPress={handleProceedToStep2}
              disabled={!packName.trim() || !selectedPackImage}
              className="h-9 px-5 mcPrimary rounded-full"
            >
              <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                Proceed
              </span>
            </Button>
          </div>
        </>
      )}

      {/* Step 2: Choose Pack Items */}
      {step === 2 && (
        <>
          {/* Search and Filters */}
          <div className="w-full bg-[#1e1f23] rounded-[10px] p-5">
            <h2 className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white mb-5">
              Choose Items (50 items max)
            </h2>

            <div className="flex flex-col md:flex-row items-center gap-5">
              {/* Search */}
              <Input
                type="text"
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Search items"
                startContent={<Icon name="search" className="w-5 h-5 text-[#6c6c71]" />}
                classNames={{
                  inputWrapper: "bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-md h-9 flex-1",
                  input: "text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]",
                }}
              />

              {/* Price Filter */}
              <div className="flex flex-row items-center gap-2">
                <div className="flex flex-row items-center gap-2 px-3  bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-md h-9">
                  <span className="text-sm leading-[15px] py-2 tracking-[-0.02em] font-medium text-white">
                    LTE
                  </span>
                  <input
                    value={maxPrice?.toString() || ""}
                    onChange={(e) => setMaxPrice(e ? parseFloat(e.target.value) : undefined)}
                    placeholder="$0.05"
                    className="w-12 text-white outline-none"
                    min={0}
                    type="number"
                  />
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-row items-center gap-0.5">
                  <Button
                    onPress={() => setMaxPrice(0)}
                    className="h-[30px] px-2.5 bg-[rgba(63,71,84,0.24)] border border-[rgba(63,71,84,0.24)] rounded-full"
                  >
                    <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                      Min
                    </span>
                  </Button>
                  <Button
                    onPress={() => setMaxPrice((maxPrice ?? 0) / 2)}
                    className="h-[30px] px-2.5 bg-[rgba(63,71,84,0.24)] border border-[rgba(63,71,84,0.24)] rounded-full"
                  >
                    <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                      1/2x
                    </span>
                  </Button>
                  <Button
                    onPress={() => setMaxPrice((maxPrice ?? 0) * 2)}
                    className="h-[30px] px-2.5 bg-[rgba(63,71,84,0.24)] border border-[rgba(63,71,84,0.24)] rounded-full"
                  >
                    <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                      2x
                    </span>
                  </Button>
                  <Button
                    onPress={() => setMaxPrice(999999)}
                    className="h-[30px] px-2.5 bg-[rgba(63,71,84,0.24)] border border-[rgba(63,71,84,0.24)] rounded-full"
                  >
                    <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                      Max
                    </span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 mt-5">
              {packItemOptions.map((item) => {
                const isSelected = selectedItems.some((i) => i.id === item.id);
                return (
                  <Button
                    key={item.id}
                    onPress={() => handleItemToggle(item)}
                    className={`relative w-full aspect-square h-auto! bg-[rgba(63,71,84,0.12)] rounded-lg flex flex-col items-center justify-center ${isSelected ? "ring-2 ring-[#d83e4a]" : ""
                      }`}
                  >
                    <div className="w-full h-full flex items-center justify-center p-2.5">
                      <Image
                        src={item.image}
                        alt={item.name}
                        className="object-contain "
                        classNames={{
                          wrapper: "aspect-square w-1/2"
                        }}
                      />
                    </div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
                      <span className="text-xs leading-[13px] tracking-[-0.02em] font-medium text-[#6c6c71] text-center">
                        {item.name}
                      </span>
                      <span className="text-xs leading-[13px] tracking-[-0.02em] font-medium text-white text-center">
                        ${formatPriceDisplay(item.price)}
                      </span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Set Drop Chances */}
          {selectedItems.length > 0 && (
            <div className="w-full bg-[#1e1f23] rounded-[10px] p-5 relative">
              <div className="flex flex-row justify-between items-start mb-5">
                <h2 className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  Set Drop Chances
                </h2>
                <div className="flex flex-row items-center gap-2">
                  <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
                    Must be 100% in total
                  </span>
                  {/* Progress Bar */}
                  <div className="w-[240px] h-4 bg-[rgba(63,71,84,0.12)] rounded-full relative overflow-hidden">
                    <div
                      className="h-full mcPrimary rounded-full transition-all"
                      style={{ width: `${Math.min(100, totalDropChance)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                      {formatPercent(totalDropChance, 4, false)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Selected Items with Drop Chances - Card Layout */}
              <div className="flex flex-row items-start gap-2 flex-wrap mb-5">
                {selectedItems.map((item) => (
                  <SelectedItemCard
                    key={item.id}
                    item={item}
                    onRemove={handleItemToggle}
                    onDropChanceChange={handleDropChanceChange}
                  />
                ))}
              </div>

              {/* Computed Pack Price */}
              <div className="flex flex-row justify-between items-center pt-5 border-t border-[rgba(63,71,84,0.24)]">
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
                  Computed case price
                </span>
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  ${formatDecimal(computedPackPrice, 3)}
                </span>
              </div>

              {/* EV validation status (mirrors backend AdminService) */}
              {selectedItems.length >= 2 && (
                <div
                  className={`flex flex-col gap-1 pt-3 border-t border-[rgba(63,71,84,0.24)] ${evValidation.valid ? "text-[#34A853]" : "text-[#EA4335]"
                    }`}
                >
                  <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium">
                    {evValidation.valid ? "✓ " : "✗ "}
                    {evValidation.message}
                  </span>
                  {evValidation.evUser != null && evValidation.maxEvUser != null && (
                    <span className="text-xs leading-[13px] tracking-[-0.02em] opacity-90">
                      EV (user): ${formatDecimal(evValidation.evUser, 2)} · Max allowed: $
                      {formatDecimal(evValidation.maxEvUser, 2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {selectedItems.length === 0 && (
            <div className="w-full bg-[#1e1f23] rounded-[10px] p-5 text-center">
              <p className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71]">
                Select at least 2 items above
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-row items-center gap-3 w-full justify-end">
            <Button
              onPress={handleBackToStep1}
              className="h-9 px-4 bg-[rgba(63,63,63,0.24)] rounded-full "
            >
              Back
            </Button>
            <Button
              onPress={handleCreatePack}
              disabled={
                selectedItems.length < 2 ||
                totalDropChance !== 100 ||
                !evValidation.valid ||
                isLoading
              }
              isLoading={isLoading}
              className="h-9 px-5 mcPrimary rounded-full"
            >
              <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                Create case
              </span>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
