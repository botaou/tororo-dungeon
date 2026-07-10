import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EquipSlot, ItemId, MaterialId } from '../types';
import { getCharacterDef } from '../data/characters';
import { STARTING_HAPPINESS, STARTING_MATERIALS, STARTING_SATIETY } from '../game/config';

export interface BirdWallet {
  gold: number;
  inventory: Record<MaterialId, number>;
  items: Partial<Record<ItemId, number>>;
  equipment: Record<EquipSlot, ItemId | null>;
  level: number;
  exp: number;
  defense: number;
  speed: number;
  luck: number;
  satiety: number;
  happiness: number;
  // Whether this bird has joined the town yet — false for everyone until
  // the starter-selection screen (or, later, a real recruitment trigger)
  // sets it. See useWorldStore, which only renders/AI-steps recruited birds.
  isRecruited: boolean;
}

function defaultWallet(defId: string): BirdWallet {
  const def = getCharacterDef(defId);
  return {
    gold: 0,
    inventory: { ...STARTING_MATERIALS },
    items: {},
    equipment: { weapon: null, armor: null, hat: null, shield: null },
    level: 1,
    exp: 0,
    defense: def.baseDefense,
    speed: def.baseSpeed,
    luck: def.baseLuck,
    satiety: STARTING_SATIETY,
    happiness: STARTING_HAPPINESS,
    isRecruited: false,
  };
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
  // Marks a bird as having joined the town — used by the starter-selection
  // screen today; a future recruitment trigger would call the same thing.
  recruitBird: (defId: string) => void;
  // True once at least one bird has joined — the app shows the
  // starter-selection screen until this is true.
  hasAnyRecruited: () => boolean;
}

export const useBirdEconomyStore = create<BirdEconomyState & BirdEconomyActions>()(
  persist(
    (set, get) => ({
      wallets: {},

      getWallet: (defId) => ({ ...defaultWallet(defId), ...(get().wallets[defId] ?? {}) }),

      syncAll: (wallets) => set({ wallets }),

      recruitBird: (defId) =>
        set((s) => ({ wallets: { ...s.wallets, [defId]: { ...get().getWallet(defId), isRecruited: true } } })),

      hasAnyRecruited: () => Object.values(get().wallets).some((w) => w.isRecruited),
    }),
    {
      name: 'tororo-dungeon-bird-economy-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
