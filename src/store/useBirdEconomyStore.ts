import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { EquipSlot, ItemId, MaterialId } from '../types';
import { getCharacterDef } from '../data/characters';
import { ITEM_DEF_MAP } from '../data/items';
import {
  BIRD_INVENTORY_CAP,
  EQUIPMENT_SALVAGE_FRACTION,
  EQUIPMENT_SPARE_CAP,
  LEVEL_UP_ATK_GAIN,
  LEVEL_UP_HP_GAIN,
  STARTING_HAPPINESS,
  STARTING_MATERIALS,
  STARTING_SATIETY,
} from '../game/config';

const EQUIP_CATEGORIES = ['weapon', 'armor', 'hat', 'shield'];

export interface BirdWallet {
  gold: number;
  inventory: Record<MaterialId, number>;
  items: Partial<Record<ItemId, number>>;
  equipment: Record<EquipSlot, ItemId | null>;
  // See BirdState's matching fields (types.ts) — house storage, managed by
  // HouseInventoryModal.
  houseFood: Partial<Record<ItemId, number>>;
  houseTreasureIds: ItemId[];
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
    houseFood: {},
    houseTreasureIds: [],
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
        // Also re-heals already-corrupted saves: catchUpOffline used to read
        // `wallets` directly (bypassing this backfill entirely), so a
        // returning player whose offline birds leveled up before this fix
        // landed got `undefined + gain` baked in as a permanent NaN. A first
        // attempt at healing that only checked `Number.isNaN` missed it on
        // the *next* reload though — `JSON.stringify(NaN)` serializes to
        // `null` (not NaN), so AsyncStorage round-trips a NaN into `null`,
        // and `null + gain` coerces to a small *finite* number (`null` reads
        // as 0 in arithmetic) instead of staying obviously broken — real-
        // device report: stats "went very weak" instead of showing NaN, from
        // exactly that null-coerced-to-0-plus-a-few-gains math. Checking
        // `Number.isFinite` instead catches undefined/null/NaN/Infinity in
        // one go, so nothing coerces silently again.
        // A real-device report showed one specific bird (level 86) stuck
        // with atk/maxHp *below even its own level-1 base* — lower than
        // Number.isFinite alone would ever flag, so it must have been
        // healed once already from some now-untraceable intermediate broken
        // state (several fix attempts landed in quick succession) rather
        // than being undefined/null/NaN itself. atk/maxHp only ever grow via
        // grantExp's `+=`, the same loop that grew defense/speed correctly
        // for that same bird — so "below this character's own base" is a
        // simple, mechanism-independent proof of corruption, not just the
        // undefined/null/NaN/Infinity cases above. Re-healing on that
        // invariant instead of trying to enumerate every way it could have
        // broken means any future recurrence of this bug class self-heals
        // the same way, without needing another special-cased check.
        const def = getCharacterDef(defId);
        const level = merged.level;
        if (!Number.isFinite(saved?.atk) || saved!.atk < def.baseAtk) {
          merged.atk = def.baseAtk + (level - 1) * LEVEL_UP_ATK_GAIN;
        }
        if (!Number.isFinite(saved?.maxHp) || saved!.maxHp < def.baseHp) {
          merged.maxHp = def.baseHp + (level - 1) * LEVEL_UP_HP_GAIN;
        }
        // BIRD_INVENTORY_CAP used to be a "sell more urgently past this"
        // soft threshold rather than a hard limit, so a save from before it
        // became a real cap (see game/inventoryCap.ts) can still be holding
        // way more than 150 total — a real-device report found ~1500 units
        // of one material sitting on a bird, left over from the old design.
        // Trim any such backlog down to the cap once here (discarding the
        // excess outright, no compensation — it was never really "earned"
        // under the current rules) rather than making the player wait
        // through dozens of forced sell trips to work it off normally.
        // Removes the single largest material first, same "most-plentiful"
        // preference the normal sell logic uses.
        const totalHeld = Object.values(merged.inventory).reduce((sum, amount) => sum + (amount ?? 0), 0);
        if (totalHeld > BIRD_INVENTORY_CAP) {
          let excess = totalHeld - BIRD_INVENTORY_CAP;
          const entries = (Object.entries(merged.inventory) as [MaterialId, number][]).sort(
            (a, b) => (b[1] ?? 0) - (a[1] ?? 0)
          );
          for (const [materialId, amount] of entries) {
            if (excess <= 0) break;
            const trim = Math.min(amount ?? 0, excess);
            merged.inventory[materialId] = (amount ?? 0) - trim;
            excess -= trim;
          }
        }
        // Same idea, for equip-category items (weapon/armor/hat/shield):
        // EQUIPMENT_SPARE_CAP didn't exist until this same real-device
        // report (a bird held 193 spare copies of one weapon, all from
        // uncapped combat-drop crediting — see game/inventoryCap.ts's
        // addItemCapped), so an existing save can be sitting on a large
        // pre-cap backlog. Trimmed down to the cap once here — but unlike
        // the material trim above, the excess is *salvaged* for gold
        // (matching the "convert overflow to currency, don't just discard
        // it" ask that prompted this fix) rather than discarded for nothing.
        for (const itemId of Object.keys(merged.items) as ItemId[]) {
          if (!EQUIP_CATEGORIES.includes(ITEM_DEF_MAP[itemId].category)) continue;
          const owned = merged.items[itemId] ?? 0;
          if (owned > EQUIPMENT_SPARE_CAP) {
            const excessCount = owned - EQUIPMENT_SPARE_CAP;
            merged.items[itemId] = EQUIPMENT_SPARE_CAP;
            merged.gold += Math.round(ITEM_DEF_MAP[itemId].buyPrice * EQUIPMENT_SALVAGE_FRACTION * excessCount);
          }
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
