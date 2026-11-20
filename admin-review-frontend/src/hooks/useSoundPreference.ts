"use client";
import { useSyncExternalStore } from "react";
import {
  getSoundSettings,
  setSoundSettings,
  subscribeSound,
  unlockAudio
} from "@/lib/audio";

export function useSoundPreference(): [
  boolean,
  (value: boolean | ((previous: boolean) => boolean)) => void
] {
  const enabled = useSyncExternalStore(
    subscribeSound,
    () => getSoundSettings().enabled,
    () => true
  );

  return [enabled, value => {
    const next = typeof value === "function"
      ? value(getSoundSettings().enabled)
      : value;

    if (next) unlockAudio();
    setSoundSettings({ enabled: next });
  }];
}