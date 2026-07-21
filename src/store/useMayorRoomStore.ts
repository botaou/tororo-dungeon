import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FurnitureInstance, ItemId, MaterialId, MayorRoomGiftEntry } from '../types';
import { FURNITURE_CLEARANCE, FURNITURE_GIFT_LOG_MAX } from '../game/config';
import { FURNITURE_DEF_MAP } from '../data/furniture';
import { FURNITURE_RECIPES } from '../data/furnitureRecipes';
import { usePlayerStore } from './usePlayerStore';

interface MayorRoomState {
  // Phase 15①: furniture/mannequins placed in the mayor's room, in the
  // room's own dedicated 0..1 coordinate space (see FurnitureInstance) —
  // independent of everything else this project places in world/town-plot
  // coordinates. Empty by default; the player places every piece themselves,
  // same "nothing pre-built" precedent as Phase 12①'s empty-start town and
  // Phase 14's empty-start houses.
  placed: Record<string, FurnitureInstance>;
  // Phase 15③: crafted-but-not-yet-placed furniture, keyed by defId — the
  // 家具屋/仕立て屋's own craft route (see data/furnitureRecipes.ts) spends
  // materials to add here; placeFurniture below spends 1 unit from here
  // instead of paying a cost directly, same two-step "craft, then place" flow
  // as the costume-ticket system (craft → ticket → gift to unlock).
  craftedStock: Partial<Record<string, number>>;
  // A small rolling log of gifts recruited birds have left behind while
  // visiting (see ai.ts's executeVisitMayorRoom) — flavor-only, capped so it
  // never grows unbounded across a long-running save.
  gifts: MayorRoomGiftEntry[];
}

interface MayorRoomActions {
  // Spends a FurnitureRecipe's material cost to add 1 unit of its furniture
  // to craftedStock. Returns false (no state change) if the town doesn't
  // have enough of any material.
  craftFurniture: (recipeId: string) => boolean;
  // Free (non-grid) placement, same shape as useTownStore's buildHouse but
  // deliberately WITHOUT any "is this inside the town zone" check — per the
  // request, this room is its own closed space, not part of the outdoor
  // town area at all. Consumes 1 unit from craftedStock rather than paying a
  // cost directly. Returns false if there's no crafted unit to place, or the
  // spot is too close to another piece already placed here.
  placeFurniture: (defId: string, x: number, y: number) => boolean;
  addGift: (itemId: ItemId, birdName: string) => void;
}

let furnitureIdCounter = 0;

function isFurnitureSpotBlocked(x: number, y: number, placed: Record<string, FurnitureInstance>): boolean {
  for (const f of Object.values(placed)) {
    if (Math.hypot(x - f.x, y - f.y) < FURNITURE_CLEARANCE) return true;
  }
  return false;
}

export const useMayorRoomStore = create<MayorRoomState & MayorRoomActions>()(
  persist(
    (set, get) => ({
      placed: {},
      craftedStock: {},
      gifts: [],

      craftFurniture: (recipeId) => {
        const recipe = FURNITURE_RECIPES.find((r) => r.id === recipeId);
        if (!recipe) return false;
        const player = usePlayerStore.getState();
        const canAfford = (Object.entries(recipe.materialCost) as [MaterialId, number][]).every(
          ([materialId, amount]) => (player.materials[materialId] ?? 0) >= amount
        );
        if (!canAfford) return false;

        (Object.entries(recipe.materialCost) as [MaterialId, number][]).forEach(([materialId, amount]) => {
          player.addMaterials({ [materialId]: -amount });
        });
        const s = get();
        set({
          craftedStock: { ...s.craftedStock, [recipe.furnitureDefId]: (s.craftedStock[recipe.furnitureDefId] ?? 0) + 1 },
        });
        return true;
      },

      placeFurniture: (defId, x, y) => {
        const def = FURNITURE_DEF_MAP[defId];
        if (!def) return false;
        const s = get();
        if ((s.craftedStock[defId] ?? 0) <= 0) return false;
        if (isFurnitureSpotBlocked(x, y, s.placed)) return false;

        furnitureIdCounter += 1;
        const id = `furniture_${furnitureIdCounter}_${Date.now()}`;
        set({
          placed: { ...s.placed, [id]: { id, defId, x, y } },
          craftedStock: { ...s.craftedStock, [defId]: (s.craftedStock[defId] ?? 0) - 1 },
        });
        return true;
      },

      addGift: (itemId, birdName) => {
        const s = get();
        const entry: MayorRoomGiftEntry = { id: `gift_${Date.now()}_${Math.random()}`, itemId, birdName, at: Date.now() };
        set({ gifts: [...s.gifts, entry].slice(-FURNITURE_GIFT_LOG_MAX) });
      },
    }),
    {
      name: 'tororo-dungeon-mayor-room-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
