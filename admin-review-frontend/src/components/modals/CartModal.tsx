"use client";

import { useState, useEffect } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button as HerouiButton, Checkbox } from "@heroui/react";
import { addToast } from "@/lib/toast";
import { Image } from "@heroui/react";
import { getCartItems, sellCartItems, type CartItem } from "@/lib/api/cart";
import SellConfirmModal from "./SellConfirmModal";
import { formatPriceDisplay } from "@/lib/utils/format";
import { useModalStore } from "@/store/modal.store";

interface CartModalProps {
  onClose: () => void;
}

export default function CartModal({ onClose }: CartModalProps) {
  const { open } = useModalStore();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showSellConfirm, setShowSellConfirm] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [sellTotal, setSellTotal] = useState("$0");

  useEffect(() => {
    loadCartItems();
  }, []);

  const loadCartItems = async () => {
    setIsLoading(true);
    try {
      const cartData = await getCartItems("AVAILABLE");
      setCartItems(cartData);
    } catch (error) {
      console.error("Error loading cart:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemToggle = (itemId: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, isSelected: !item.isSelected } : item
      )
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setCartItems((prev) =>
      prev.map((item) => ({ ...item, isSelected: checked }))
    );
  };

  const handleSell = async () => {
    const selected = cartItems.filter((item) => item.isSelected).map((item) => item.id);
    if (selected.length === 0) return;

    setSelectedItems(selected);

    // Calculate total price for selected items
    const selectedItemsData = cartItems.filter((item) => item.isSelected);
    const total = selectedItemsData.reduce((sum, item) => {
      const price = parseFloat(item.price.replace("$", ""));
      return sum + price;
    }, 0);
    setSellTotal(`$${formatPriceDisplay(total)}`);

    setShowSellConfirm(true);
  };

  const handleWithdraw = () => {
    const selected = cartItems.filter((item) => item.isSelected).map((item) => item.id);
    if (selected.length === 0) return;

    if (selectedPrice < 10) {
      addToast({
        title: "Minimal amount",
        description: "Minimal amount for withdrawal is $10.00",
        color: "warning",
      });
      return;
    }

    // Close cart modal and open withdraw modal with the selected items + total
    onClose();
    open("withdraw", { totalAmount: selectedPrice, cartItemIds: selected });
  };

  const handleConfirmSell = async () => {
    try {
      await sellCartItems(selectedItems);
      // Remove sold items from cart
      const remainingItems = cartItems.filter((item) => !item.isSelected);
      setCartItems(remainingItems);

      // Update totals
      const newTotal = remainingItems.reduce((sum, item) => {
        const price = parseFloat(item.price.replace("$", ""));
        return sum + price;
      }, 0);
      setTotalItems(remainingItems.length);

      setShowSellConfirm(false);
      addToast({
        title: "Sold successfully",
        description: `Sold ${selectedItems.length} item${selectedItems.length === 1 ? "" : "s"} for ${sellTotal}.`,
        color: "success",
      });
    } catch (error) {
      console.error("Error selling items:", error);
      addToast({
        title: "Sell failed",
        description: error instanceof Error ? error.message : "Failed to sell items. Please try again.",
        color: "danger",
      });
    }
  };

  const selectedCount = cartItems.filter((item) => item.isSelected).length;
  const allSelected = cartItems.length > 0 && selectedCount === cartItems.length;
  const someSelected = selectedCount > 0 && selectedCount < cartItems.length;
  const totalPrice = cartItems.reduce((sum, item) => {
    const price = parseFloat(item.price);
    return sum + price;
  }, 0);
  const selectedPrice = cartItems.filter((item) => item.isSelected).reduce((sum, item) => {
    const price = parseFloat(item.price);
    return sum + price;
  }, 0);

  return (
    <>
      <Modal
        isOpen={true}
        onClose={onClose}
        size="2xl"
        classNames={{
          base: "bg-[#1e1f23] border border-[rgba(63,71,84,0.24)] rounded-[20px] relative",
          backdrop: "bg-black/50",
        }}
      >
        <ModalContent className="sm:p-5">
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 pb-0">
                <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
                  Your Cart - {formatPriceDisplay(totalPrice)}
                </h2>
              </ModalHeader>
              <ModalBody className="gap-5 pt-5">
                {/* Header with Select All and Sell buttons */}
                <div className="flex flex-row justify-between items-center w-full h-9">
                  <div className="flex justify-between w-full items-center">
                    <p className="text-white"><span>{selectedCount}</span> items selected- ${formatPriceDisplay(selectedPrice)}</p>
                    <div className="hidden sm:flex flex-row items-center gap-2">
                      <HerouiButton
                        onPress={handleSell}
                        isDisabled={selectedCount === 0}
                        className="w-[100px] h-9 px-4 bg-button-primary rounded-full text-white text-sm font-medium disabled:opacity-50"
                      >
                        Sell
                      </HerouiButton>
                      <HerouiButton
                        onPress={handleWithdraw}
                        isDisabled={selectedCount === 0}
                        className="w-[100px] h-9 rounded-full text-white text-sm font-medium bg-[rgba(63,71,84,0.12)]"
                      >
                        {`Withdraw`}
                      </HerouiButton>
                    </div>
                  </div>


                </div>

                {/* Cart Items Grid */}
                <div className="flex flex-col items-start gap-2 w-full overflow-y-auto max-h-[436px]">
                  {/* First Row */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 w-full h-[400px] overflow-y-auto scrollbar-hide">
                    {cartItems.map((item) => (
                      <CartItemCard
                        key={item.id}
                        item={item}
                        onToggle={() => handleItemToggle(item.id)}
                      />
                    ))}
                  </div>
                </div>
              </ModalBody>
              <div className="bg-transparent backdrop-blur-sm border-t border-[rgba(63,71,84,0.24)] rounded-b-[20px] px-5 py-4 absolute bottom-0 left-0 w-full">
                <div className="flex flex-row justify-between items-center w-full">
                  <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                    {selectedCount} items - ${formatPriceDisplay(totalPrice)}
                  </span>
                  <div className="flex flex-row items-center gap-6">
                    <Checkbox
                      isSelected={allSelected}
                      isIndeterminate={someSelected}
                      onValueChange={handleSelectAll}
                      classNames={{
                        base: "w-5 h-5",
                        wrapper: "bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-md",
                      }}
                    />
                    <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                      Select all items
                    </span>
                  </div>
                </div>
                <div className="sm:hidden flex flex-row items-center gap-2 mt-2">
                  <HerouiButton
                    onPress={handleSell}
                    isDisabled={selectedCount === 0}
                    className="w-full h-9 px-4 bg-button-primary rounded-full text-white text-sm font-medium disabled:opacity-50"
                  >
                    Sell
                  </HerouiButton>
                  <HerouiButton
                    onPress={handleWithdraw}
                    isDisabled={selectedCount === 0}
                    className="w-full h-9 rounded-full text-white text-sm font-medium bg-[rgba(63,71,84,0.12)]"
                  >
                    {`Withdraw`}
                  </HerouiButton>
                </div>
              </div>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Sell Confirmation Modal */}
      {showSellConfirm && (
        <SellConfirmModal
          itemCount={selectedCount}
          totalPrice={sellTotal}
          onConfirm={handleConfirmSell}
          onCancel={() => setShowSellConfirm(false)}
        />
      )}
    </>
  );
}

interface CartItemCardProps {
  item: CartItem;
  onToggle: () => void;
}

function CartItemCard({ item, onToggle }: CartItemCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent toggle if clicking directly on checkbox (checkbox handles its own click)
    const target = e.target as HTMLElement;
    if (target.closest('[role="checkbox"]') || target.closest('input[type="checkbox"]') || target.closest('label')) {
      return;
    }
    onToggle();
  };

  return (
    <div
      className="relative h-[140px] bg-[rgba(63,71,84,0.12)] rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
      onClick={handleCardClick}
    >
      {/* Checkbox */}
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          isSelected={item.isSelected}
          onValueChange={onToggle}
          classNames={{
            base: "absolute top-3 right-5 z-10 w-5 h-5",
            wrapper: "bg-[#0f1013] border border-[rgba(63,71,84,0.24)] rounded-md",
          }}
        />
      </div>

      {/* Product Image */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-[15.5px] w-[75px] h-[75px] flex items-center justify-center pointer-events-none">
        <div className={`relative w-full h-full ${item.itemType === "VOUCHER" ? "rotate-15" : ""}`}>
          <Image
            src={item.itemType === "ITEM" ? item.image : "/assets/images/voucher.svg"}
            alt={item.name}
            width={75}
            height={75}
            className="w-full h-full object-contain"
          />
          {item.itemType === "VOUCHER" && <span className="font-mono text-center text-background-base w-full absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 h-5">${formatPriceDisplay(item.price)}</span>}
        </div>
      </div>

      {/* Product Name and Price */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2  flex flex-col items-center gap-0.5 pb-2 pointer-events-none w-full">
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-[#6c6c71] text-center truncate w-10/12">
          {item.name}
        </span>
        <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white text-center">
          ${formatPriceDisplay(item.price)}
        </span>
      </div>
    </div>
  );
}