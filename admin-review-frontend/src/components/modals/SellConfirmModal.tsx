"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button as HerouiButton } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";

interface SellConfirmModalProps {
  itemCount: number;
  totalPrice: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SellConfirmModal({
  itemCount,
  totalPrice,
  onConfirm,
  onCancel,
}: SellConfirmModalProps) {
  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      size="sm"
      backdrop="blur"
      classNames={{
        base: "bg-[#1e1f23] border border-[rgba(63,71,84,0.24)] rounded-[20px]",
        backdrop: "bg-black/50",
      }}
    >
      <ModalContent className="w-[360px] relative">
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 pb-0">
              <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
                Sell {itemCount} items for {totalPrice}
              </h2>
            </ModalHeader>
            <ModalBody className="gap-3 pt-5">
              <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-[#6c6c71]">
                Once an item is sold, it can't be recovered. Please confirm that you're sure before continuing.
              </p>
              <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-white">
                Your account will be credited with {totalPrice}
              </p>
            </ModalBody>
            <ModalFooter className="gap-2">
              <HerouiButton
                onPress={onCancel}
                className="flex-1 h-9 px-4 bg-[rgba(63,71,84,0.24)] rounded-full text-white text-sm leading-[15px] tracking-[-0.02em] font-medium"
              >
                Cancel
              </HerouiButton>
              <HerouiButton
                onPress={() => {
                  onConfirm();
                  onClose();
                }}
                className="flex-1 h-9 px-4 mcPrimary rounded-full text-white text-sm leading-[15px] tracking-[-0.02em] font-medium"
              >
                Confirm
              </HerouiButton>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
