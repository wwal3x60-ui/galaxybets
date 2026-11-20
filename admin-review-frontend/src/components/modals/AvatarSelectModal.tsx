"use client";

import { useState } from "react";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Image } from "@heroui/react";

interface AvatarSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (avatarPath: string) => void;
  currentAvatar?: string | null;
}

// Generate list of pre-generated avatars
const generateAvatarList = (): string[] => {
  const avatars: string[] = [];
  // Add numbered avatars (1-22)
  for (let i = 1; i <= 22; i++) {
    avatars.push(`/assets/avatar/avatar (${i}).png`);
  }
  // Add other avatars
  const otherAvatars = [
    "alien.png",
    "animal1.png",
    "animal2.png",
    "animal3.png",
    "astronaut1.png",
    "astronaut2.png",
    "crab.png",
    "girl1.png",
    "girl2.png",
    "man1.png",
    "man2.png",
    "man3.png",
    "man4.png",
    "man5.png",
    "man6.png",
    "man7.png",
    "man8.png",
    "robot.png",
    "rocket.png",
    "spaceship1.png",
    "spaceship2.png",
    "spaceship3.png",
  ];
  otherAvatars.forEach((avatar) => {
    avatars.push(`/assets/avatar/${avatar}`);
  });
  return avatars;
};

const AVATARS = generateAvatarList();

export function AvatarSelectModal({
  isOpen,
  onClose,
  onSelect,
  currentAvatar,
}: AvatarSelectModalProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(
    currentAvatar || null
  );

  const handleSelect = () => {
    if (selectedAvatar) {
      onSelect(selectedAvatar);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      classNames={{
        base: "bg-background-elevated border border-[rgba(63,71,84,0.24)] rounded-[20px]",
        backdrop: "bg-black/50",
      }}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>
              <h2 className="text-lg leading-[20px] tracking-[-0.02em] font-medium text-white">
                Select Avatar
              </h2>
            </ModalHeader>
            <ModalBody>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 max-h-[400px] overflow-y-auto">
                {AVATARS.map((avatarPath) => {
                  const isSelected = selectedAvatar === avatarPath;
                  return (
                    <button
                      key={avatarPath}
                      onClick={() => setSelectedAvatar(avatarPath)}
                      className={`
                        relative w-16 h-16 rounded-full overflow-hidden
                        border-2 transition-all
                        ${
                          isSelected
                            ? "border-[#d83e4a] ring-2 ring-[#d83e4a] ring-offset-2 ring-offset-background-elevated"
                            : "border-transparent hover:border-[rgba(63,71,84,0.5)]"
                        }
                      `}
                    >
                      <Image
                        src={avatarPath}
                        alt="Avatar"
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 mcPrimary/20 flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                onPress={onClose}
                className="h-9 px-5 bg-[rgba(63,71,84,0.24)] rounded-full"
              >
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  Cancel
                </span>
              </Button>
              <Button
                onPress={handleSelect}
                isDisabled={!selectedAvatar}
                className="h-9 px-5 mcPrimary rounded-full"
              >
                <span className="text-sm leading-[15px] tracking-[-0.02em] font-medium text-white">
                  Select
                </span>
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
