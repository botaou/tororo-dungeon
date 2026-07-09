import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MaterialId } from '../types';
import { STARTING_MATERIALS } from '../game/config';

export interface BirdWallet {
  gold: number;
  inventory: Record<MaterialId, number>;
}

function defaultWallet(): BirdWallet {
  return { gold: 0, inventory: { ...STARTING_MATERIALS } };
}

interface BirdEconomyState {
  wallets: Record<string, BirdWallet>;
}

interface BirdEconomyActions {
  // Every bird is a fixed individual, so this either returns their
  // persisted wallet or a fresh empty one for a bird never seen before.
  getWallet: (defId: string) => BirdWallet;
  // Called once per tick with every bird's current gold/inventory — a
  // single batched write instead of one per bird per mutation.
  syncAll: (wallets: Record<string, BirdWallet>) => void;
}

export const useBirdEconomyStore = create<BirdEconomyState & BirdEconomyActions>()(
  persist(
    (set, get) => ({
      wallets: {},

      getWallet: (defId) => get().wallets[defId] ?? defaultWallet(),

      syncAll: (wallets) => set({ wallets }),
    }),
    {
      name: 'tororo-dungeon-bird-economy-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
