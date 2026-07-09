import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MaterialId, PlayerState } from '../types';
import { STARTING_GOLD, STARTING_MATERIALS } from '../game/config';

interface PlayerActions {
  addGold: (amount: number) => void;
  trySpendGold: (amount: number) => boolean;
  addMaterials: (rewards: Partial<Record<MaterialId, number>>) => void;
}

type PlayerStore = PlayerState & PlayerActions;

const initialState: PlayerState = {
  gold: STARTING_GOLD,
  materials: { ...STARTING_MATERIALS },
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
    }),
    {
      // Bumped from v1: the schema changed (stamina removed, gold is now a
      // currency instead of a material) and old saved data isn't compatible.
      name: 'tororo-dungeon-player-v2',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
