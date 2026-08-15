import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DisplayedGiftInstance, FurnitureInstance, ItemId, MaterialId, MayorRoomGiftEntry } from '../types';
import { FURNITURE_CLEARANCE, MAYOR_ROOM_GIFT_PILE_MAX } from '../game/config';
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
  // Item 85: gifts recruited birds leave behind while visiting (see ai.ts's
  // executeVisitMayorRoom) now sit here as an actionable "pile" — unlike the
  // pre-item-85 version, entries are NOT silently dropped once a small
  // display cap is hit (see MAYOR_ROOM_GIFT_PILE_MAX's own comment); each
  // stays until the player resolves it via placeGiftFromPile or
  // storeGiftToWarehouse below.
  gifts: MayorRoomGiftEntry[];
  // Item 85: gifts the player chose to "飾る" — placed in the room the same
  // way as `placed` furniture, just sourced from the ItemId namespace.
  // Deliberately a separate map from `placed` rather than folding gifts
  // into FurnitureInstance itself — a gift has no FurnitureDef/recipe/
  // craftedStock entry backing it, it's just whatever ItemId a bird happened
  // to be carrying, so giving it its own instance type keeps `placed`
  // strictly "real furniture, always resolvable via FURNITURE_DEF_MAP".
  displayedGifts: Record<string, DisplayedGiftInstance>;
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
  // spot is too close to another piece already placed here (furniture OR a
  // displayed gift, see isRoomSpotBlocked).
  placeFurniture: (defId: string, x: number, y: number) => boolean;
  addGift: (itemId: ItemId, birdName: string) => void;
  // Item 85: resolves one pile entry by "飾る" — moves it out of `gifts` and
  // into `displayedGifts` at the given room position. Returns false (no
  // state change) if the gift id isn't in the pile, or the spot is blocked.
  placeGiftFromPile: (giftId: string, x: number, y: number) => boolean;
  // Item 85: resolves one pile entry by "収納する" — removes it from `gifts`
  // and adds 1 unit of its itemId to the town warehouse (usePlayerStore.items,
  // via the existing addItems action — the same warehouse every shop's
  // StockingPanel already draws from). Returns false if the gift id isn't
  // in the pile.
  storeGiftToWarehouse: (giftId: string) => boolean;
}

let furnitureIdCounter = 0;
let giftInstanceIdCounter = 0;

// Item 85: shared by both placeFurniture and placeGiftFromPile — the room
// is one shared canvas, so a new furniture piece shouldn't land on top of
// an already-displayed gift and vice versa, not just avoid other furniture.
function isRoomSpotBlocked(
  x: number,
  y: number,
  placed: Record<string, FurnitureInstance>,
  displayedGifts: Record<string, DisplayedGiftInstance>
): boolean {
  for (const f of Object.values(placed)) {
    if (Math.hypot(x - f.x, y - f.y) < FURNITURE_CLEARANCE) return true;
  }
  for (const g of Object.values(displayedGifts)) {
    if (Math.hypot(x - g.x, y - g.y) < FURNITURE_CLEARANCE) return true;
  }
  return false;
}

export const useMayorRoomStore = create<MayorRoomState & MayorRoomActions>()(
  persist(
    (set, get) => ({
      placed: {},
      craftedStock: {},
      gifts: [],
      displayedGifts: {},

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
        if (isRoomSpotBlocked(x, y, s.placed, s.displayedGifts)) return false;

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
        set({ gifts: [...s.gifts, entry].slice(-MAYOR_ROOM_GIFT_PILE_MAX) });
      },

      placeGiftFromPile: (giftId, x, y) => {
        const s = get();
        const gift = s.gifts.find((g) => g.id === giftId);
        if (!gift) return false;
        if (isRoomSpotBlocked(x, y, s.placed, s.displayedGifts)) return false;

        giftInstanceIdCounter += 1;
        const instanceId = `displayedGift_${giftInstanceIdCounter}_${Date.now()}`;
        set({
          gifts: s.gifts.filter((g) => g.id !== giftId),
          displayedGifts: { ...s.displayedGifts, [instanceId]: { id: instanceId, itemId: gift.itemId, x, y } },
        });
        return true;
      },

      storeGiftToWarehouse: (giftId) => {
        const s = get();
        const gift = s.gifts.find((g) => g.id === giftId);
        if (!gift) return false;
        set({ gifts: s.gifts.filter((g) => g.id !== giftId) });
        usePlayerStore.getState().addItems(gift.itemId, 1);
        return true;
      },
    }),
    {
      name: 'tororo-dungeon-mayor-room-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
