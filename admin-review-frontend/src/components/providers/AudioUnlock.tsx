"use client";

import { useEffect, useState } from "react";
import { unlockAudio, isAudioUnlocked } from "@/lib/audio";

/**
 * Unlocks audio on first user interaction so battle/slot sounds can play.
 * Shows an "Enable sound" button until the user has granted audio (click/tap).
 */
export function AudioUnlock() {
  const [unlocked, setUnlocked] = useState(false);

  const handleUnlock = () => {
    if (isAudioUnlocked()) {
      setUnlocked(true);
      return;
    }
    unlockAudio();
    setUnlocked(true);
  };

  useEffect(() => {
    if (typeof document === "undefined" || isAudioUnlocked()) {
      setUnlocked(true);
      return;
    }

    const unlock = () => {
      unlockAudio();
      setUnlocked(true);
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
    };

    document.addEventListener("click", unlock, { once: true, passive: true });
    document.addEventListener("touchstart", unlock, { once: true, passive: true });
    document.addEventListener("keydown", unlock, { once: true, passive: true });

    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  if (unlocked) return null;

  return (
    <button
      type="button"
      onClick={handleUnlock}
      className="fixed bottom-20 right-4 z-50 rounded-full bg-[rgba(63,71,84,0.9)] px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-[rgba(63,71,84,1)] focus:outline-none focus:ring-2 focus:ring-white/50"
      aria-label="Enable game sound"
    >
      Enable sound
    </button>
  );
}
