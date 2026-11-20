"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import Fireworks from "react-canvas-confetti/dist/presets/fireworks";
import JackpotWheel, { type JackpotWheelSegment } from "@/components/battles/JackpotWheel";
import { playExtraWin } from "@/lib/audio";

export type JackpotPlayerBadge = {
  id: string; // participantId
  name: string;
  avatarUrl: string;
  color: string;
};

export default function JackpotModal({
  onClose,
  segments,
  badges = [],
  ticketNumber,
  winnerId,
  spinDurationMs = 7000,
  onFinished,
}: {
  onClose: () => void;
  segments: JackpotWheelSegment[];
  badges?: JackpotPlayerBadge[];
  ticketNumber?: number;
  winnerId?: string | null;
  spinDurationMs?: number;
  onFinished?: () => void;
}) {
  const [done, setDone] = useState(false);
  const conductorRef = useRef<{ run: (params: { speed: number; duration?: number; delay?: number }) => void; shoot: () => void } | null>(null);

  const canRenderWheel = useMemo(() => {
    return Number.isFinite(ticketNumber) && (ticketNumber ?? 0) > 0 && Array.isArray(segments) && segments.length > 0;
  }, [segments, ticketNumber]);

  useEffect(() => {
    // Reset on open with new ticket/segments
    setDone(false);
  }, [ticketNumber, segments?.length]);

  const handleSpinEnd = () => {
    if (done) return;
    setDone(true);
    playExtraWin();
    conductorRef.current?.run({ speed: 2, duration: 2500 });
    onFinished?.();
  };

  return (
    <>
      <Fireworks
        width="100%"
        height="100%"
        style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 9999 }}
        onInit={({ conductor }) => {
          conductorRef.current = conductor;
        }}
      />
      <Modal
        isOpen={true}
        onClose={done ? onClose : () => {}}
        size="xl"
        isDismissable={done}
        isKeyboardDismissDisabled={!done}
        hideCloseButton={!done}
        classNames={{
          base: "bg-[#1e1f23] border border-[rgba(63,71,84,0.24)] rounded-[20px] relative",
          backdrop: "bg-black/60",
        }}
      >
        <ModalContent className="p-5">
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1 pb-0">
              <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">Jackpot</h2>
              <p className="text-xs text-[#afafb4]">
                {done ? "Result locked in" : "Spinning..."}
              </p>
            </ModalHeader>
            <ModalBody className="gap-4 pt-5 flex items-center justify-center">
              {canRenderWheel ? (
                <JackpotWheel
                  key={`${ticketNumber}-${segments.length}`}
                  segments={segments}
                  ticketNumber={ticketNumber!}
                  winnerId={winnerId ?? null}
                  spinDurationMs={spinDurationMs}
                  autoSpin={true}
                  onSpinEnd={handleSpinEnd}
                />
              ) : (
                <div className="text-[#afafb4] text-sm">Loading jackpot…</div>
              )}
            </ModalBody>
            <ModalFooter className="gap-2 flex flex-col">
              {badges.length > 0 ? (
                <div className="w-full flex items-center justify-center gap-2 pb-1">
                  {badges.map((b) => (
                    <div
                      key={b.id}
                      className="w-8 h-8 rounded-full border-2 bg-[#0f1013] overflow-hidden"
                      style={{ borderColor: b.color }}
                      title={b.name}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.avatarUrl} alt={b.name} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}
              <Button
                className="w-full h-10 rounded-full bg-[rgba(63,71,84,0.12)] text-white"
                isDisabled={!done}
                onPress={done ? onClose : undefined}
              >
                Continue
              </Button>
            </ModalFooter>
          </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}

