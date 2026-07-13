import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EquipSlot, ItemId, MaterialId } from '../types';
import { getCharacterDef } from '../data/characters';
import {
  LEVEL_UP_ATK_GAIN,
  LEVEL_UP_HP_GAIN,
  STARTING_HAPPINESS,
  STARTING_MATERIALS,
  STARTING_SATIETY,
} from '../game/config';

export interface BirdWallet {
  gold: number;
  inventory: Record<MaterialId, number>;
  items: Partial<Record<ItemId, number>>;
  equipment: Record<EquipSlot, ItemId | null>;
  level: number;
  exp: number;
  atk: number;
  maxHp: number;
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
    atk: def.baseAtk,
    maxHp: def.baseHp,
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
  // Same as getWallet, but for every known bird at once — see its own
  // comment for why this exists instead of just reading `.wallets` raw.
  getAllWallets: () => Record<string, BirdWallet>;
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

      getWallet: (defId) => {
        const base = defaultWallet(defId);
        const saved = get().wallets[defId];
        const merged = { ...base, ...(saved ?? {}) };
        // atk/maxHp were added after level-up growth already existed (see
        // useWorldStore's grantExp, which was bumping bird.atk/bird.maxHp on
        // the in-memory session state the whole time but had nowhere
        // persisted to put the gain) — a save from before this field existed
        // would otherwise fall back to defaultWallet's flat level-1 base
        // every single launch, silently discarding every level's worth of
        // atk/HP growth (real-device report: a level-82 bird still showing
        // level-1 attack/HP). Backfill proportional to the level already
        // reached instead of resetting to base, so existing saves get
        // retroactive credit once, then keep growing normally afterward.
        // Also re-heals NaN specifically: catchUpOffline used to read
        // `wallets` directly (bypassing this backfill entirely), so a
        // returning player whose offline birds leveled up before this fix
        // landed got `undefined + gain` baked in as a permanent NaN — this
        // check catches that already-corrupted state too, not just the
        // missing-field case, since NaN !== undefined would otherwise skip
        // right past a plain `=== undefined` guard forever.
        const def = getCharacterDef(defId);
        const level = merged.level;
        if (!saved || saved.atk === undefined || Number.isNaN(saved.atk)) {
          merged.atk = def.baseAtk + (level - 1) * LEVEL_UP_ATK_GAIN;
        }
        if (!saved || saved.maxHp === undefined || Number.isNaN(saved.maxHp)) {
          merged.maxHp = def.baseHp + (level - 1) * LEVEL_UP_HP_GAIN;
        }
        return merged;
      },

      // Every known wallet, each passed through getWallet's backfill/NaN-
      // healing — plain `get().wallets` skips that entirely, which is
      // exactly what let catchUpOffline corrupt atk/maxHp to NaN in the
      // first place (see getWallet's comment). Anything that needs more
      // than one wallet at once (today: only the offline catch-up) should
      // use this instead of reading the raw `wallets` record.
      getAllWallets: () => {
        const raw = get().wallets;
        const result: Record<string, BirdWallet> = {};
        for (const defId of Object.keys(raw)) result[defId] = get().getWallet(defId);
        return result;
      },

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
