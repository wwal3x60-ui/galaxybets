import { create } from 'zustand';
import { type PackItem } from '@/lib/api/packs';

interface SpinState {
  // Slot index -> forced result (if a real open happened)
  forcedResults: Map<number, PackItem | null>;
  
  // Set forced result for a specific slot
  setForcedResult: (slotIndex: number, result: PackItem | null) => void;
  
  // Clear all forced results (when resetting drawer session)
  clearAllResults: () => void;
  
  // Set multiple results at once (for drawer multi-open)
  setForcedResults: (results: Array<PackItem | null>) => void;
}

export const useSpinStore = create<SpinState>((set) => ({
  forcedResults: new Map(),
  
  setForcedResult: (slotIndex, result) =>
    set((state) => {
      const newMap = new Map(state.forcedResults);
      newMap.set(slotIndex, result);
      return { forcedResults: newMap };
    }),
  
  clearAllResults: () =>
    set({ forcedResults: new Map() }),
  
  setForcedResults: (results) =>
    set(() => {
      const newMap = new Map<number, PackItem | null>();
      results.forEach((result, index) => {
        newMap.set(index, result);
      });
      return { forcedResults: newMap };
    }),
}));
