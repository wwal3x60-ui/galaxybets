"use client";

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/react";
import { Icon } from "@/components/ui/Icon";
import { Image } from "@heroui/react";
import { useModalStore } from "@/store/modal.store";
import { type PackItem } from "@/lib/api/packs";
import { formatPrice } from "@/lib/utils/format";
import { cleanNumber, formatPercent } from "@/lib/utils/numbers";

const PackItemModal = () => {
  const { modal, modalProps, close } = useModalStore();
  const item = modalProps?.item as PackItem | undefined;
  const ticketRangeProp = (modalProps as any)?.ticketRange as
    | { startTicket: number; endTicket: number }
    | null
    | undefined;

  if (modal !== 'pack-item' || !item) return null;

  const formattedPrice = formatPrice(item.template?.value ?? item.price);

  const probabilityRaw = (item as any)?.metadata?.probability;
  const probabilityNum = typeof probabilityRaw === "number" && Number.isFinite(probabilityRaw) ? probabilityRaw : 0;
  const probabilityPercentage = cleanNumber(probabilityNum * 100, 4); // 0..1 -> %
  const formattedProbability = formatPercent(probabilityPercentage, 4, false);

  const startTicket = ticketRangeProp?.startTicket ?? item.startTicket ?? null;
  const endTicket = ticketRangeProp?.endTicket ?? item.endTicket ?? null;
  const ticketRange =
    typeof startTicket === "number" &&
    typeof endTicket === "number" &&
    Number.isFinite(startTicket) &&
    Number.isFinite(endTicket) &&
    startTicket >= 1 &&
    endTicket >= startTicket
      ? `${startTicket} - ${endTicket}`
      : "N/A";

  return (
    <Modal
      isOpen={true}
      onClose={close}
      size="xl"
      classNames={{
        base: "bg-[#1e1f23] border border-[rgba(63,71,84,0.24)] rounded-[20px]",
        backdrop: "bg-black/50",
        body: "p-0",
      }}
    >
      <ModalContent className="p-0">
        <ModalHeader>
          <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
            Product Details
          </h2>
        </ModalHeader>
        <ModalBody>
          <div className="relative flex flex-col items-start p-5 gap-5 ">
             {/* Image Container */}
             <div className="relative w-full h-[320px] bg-[rgba(63,71,84,0.12)] rounded-[10px] flex items-center justify-center overflow-hidden">
               <Image
                 src={item.template?.imageUrl ?? item.image}
                 alt={item.template?.name ?? item.name}
                 className="max-w-full max-h-64 w-auto h-auto object-contain"
               />
             </div>

            {/* Name and Price Row */}
            <div className=" flex md:flex-row flex-col justify-between items-center w-full ">
              <h3 className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white text-left flex-1">
                {item.template?.name ?? item.name}
              </h3>
              <p className="text-base text-white leading-[17px] tracking-[-0.02em] font-medium text-right w-full md:w-auto">
                ${formattedPrice}
              </p>
            </div>

            {/* Description */}
            {item.description && (
              <p className="text-sm leading-[140%] tracking-[-0.02em] font-medium text-text-muted w-full">
                {item.description}
              </p>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          {/* Outcome and Ticket Numbers */}
          <div className="flex flex-row justify-between items-center w-full">
            {/* Outcome */}
            <div className="flex flex-col items-start gap-4">
              <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-text-muted">
                Outcome
              </span>
              <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
                {formattedProbability}
              </span>
            </div>

            {/* Ticket Numbers */}
            <div className="flex flex-col items-end gap-4">
              <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-text-muted">
                Ticket Numbers
              </span>
              <span className="text-base leading-[17px] tracking-[-0.02em] font-medium text-white">
                {ticketRange}
              </span>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default PackItemModal;
