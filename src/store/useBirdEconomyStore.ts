import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ItemId, MaterialId } from '../types';
import { STARTING_MATERIALS } from '../game/config';

export interface BirdWallet {
  gold: number;
  inventory: Record<MaterialId, number>;
  items: Partial<Record<ItemId, number>>;
  level: number;
  exp: number;
}

function defaultWallet(): BirdWallet {
  return { gold: 0, inventory: { ...STARTING_MATERIALS }, items: {}, level: 1, exp: 0 };
}

interface BirdEconomyState {
  wallets: Record<string, BirdWallet>;
}

interface BirdEconomyActions {
  // Every bird is a fixed individual, so this either returns their
  // persisted wallet or a fresh empty one for a bird never seen before.
  // Merged over the defaults so fields added after a wallet was first
  // persisted (e.g. level/exp) still come back populated instead of
  // undefined.
  getWallet: (defId: string) => BirdWallet;
  // Called once per tick with every bird's current gold/inventory/level/exp
  // — a single batched write instead of one per bird per mutation.
  syncAll: (wallets: Record<string, BirdWallet>) => void;
}

export const useBirdEconomyStore = create<BirdEconomyState & BirdEconomyActions>()(
  persist(
    (set, get) => ({
      wallets: {},

      getWallet: (defId) => ({ ...defaultWallet(), ...(get().wallets[defId] ?? {}) }),

      syncAll: (wallets) => set({ wallets }),
    }),
    {
      name: 'tororo-dungeon-bird-economy-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
