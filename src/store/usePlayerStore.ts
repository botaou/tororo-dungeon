import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MaterialId, PlayerState } from '../types';
import { STARTING_GOLD, STARTING_MATERIALS } from '../game/config';

interface PlayerActions {
  addGold: (amount: number) => void;
  trySpendGold: (amount: number) => boolean;
  addMaterials: (rewards: Partial<Record<MaterialId, number>>) => void;
  // Each credits the treasury and its matching lifetime ledger counter in
  // one call, so the two can never drift out of sync.
  creditHuntToll: (amount: number) => void;
  creditFoodToll: (amount: number) => void;
  creditTravelerToll: (amount: number) => void;
}

type PlayerStore = PlayerState & PlayerActions;

const initialState: PlayerState = {
  gold: STARTING_GOLD,
  materials: { ...STARTING_MATERIALS },
  tollFromHunt: 0,
  tollFromFood: 0,
  tollFromTraveler: 0,
};

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      addGold: (amount) => set({ gold: get().gold + amount }),

      trySpendGold: (amount) => {
        const { gold } = get();
        if (gold < amount) return false;
        set({ gold: gold - amount });
        return true;
      },

      addMaterials: (rewards) => {
        const { materials } = get();
        const next = { ...materials };
        (Object.keys(rewards) as MaterialId[]).forEach((key) => {
          next[key] = (next[key] ?? 0) + (rewards[key] ?? 0);
        });
        set({ materials: next });
      },

      creditHuntToll: (amount) => set((s) => ({ gold: s.gold + amount, tollFromHunt: s.tollFromHunt + amount })),
      creditFoodToll: (amount) => set((s) => ({ gold: s.gold + amount, tollFromFood: s.tollFromFood + amount })),
      creditTravelerToll: (amount) =>
        set((s) => ({ gold: s.gold + amount, tollFromTraveler: s.tollFromTraveler + amount })),
    }),
    {
      // Bumped from v1: the schema changed (stamina removed, gold is now a
      // currency instead of a material) and old saved data isn't compatible.
      name: 'tororo-dungeon-player-v2',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
