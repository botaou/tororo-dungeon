import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ItemId, MaterialId, PlayerState, ShopKind } from '../types';
import { STARTING_GOLD, STARTING_MATERIALS } from '../game/config';
import { CRAFTING_RECIPES } from '../data/recipes';
import { MATERIAL_SELL_PRICE } from '../data/marketPrices';
import { useRecipeStore } from './useRecipeStore';

interface PlayerActions {
  addGold: (amount: number) => void;
  trySpendGold: (amount: number) => boolean;
  addMaterials: (rewards: Partial<Record<MaterialId, number>>) => void;
  // Each credits the treasury and its matching lifetime ledger counter in
  // one call, so the two can never drift out of sync.
  creditHuntToll: (amount: number) => void;
  creditFoodToll: (amount: number) => void;
  creditTravelerToll: (amount: number) => void;
  creditShopToll: (amount: number) => void;
  // Merchant-related income: the town's 50% cut of a bird's convertible-item
  // sale (the "market usage fee"), and — since sellMaterialToMerchant below
  // credits through the same action — the player's own warehouse-material
  // sales to a visiting merchant too.
  creditMerchantToll: (amount: number) => void;
  // Player-initiated: sell up to `amount` of the town warehouse's stock of
  // one material to the visiting merchant, at the same flat rate the
  // traveler and bird-to-shop sales use (MATERIAL_SELL_PRICE) — a real-
  // device request for a way to offload warehouse material for gold that
  // wasn't tied to the random traveler or to birds selling their own
  // gathered stock. Clamped to whatever's actually in stock (not rejected
  // outright) — a real-device follow-up: selling the *entire* stack in one
  // tap by default risked accidentally selling off material the player
  // still needed, so the caller now picks how much. Returns the gold
  // earned (0 if there was nothing to sell).
  sellMaterialToMerchant: (materialId: MaterialId, amount: number) => number;
  // The player's main hands-on action: spend the recipe's material cost
  // out of the town warehouse to produce one crafted item. Returns false
  // (no state change) if the town doesn't have enough of any material.
  craftItem: (recipeId: string) => boolean;
  // Move `amount` units of a warehouse item onto a shop's shelf, making it
  // actually purchasable. Returns false if the warehouse doesn't have enough.
  stockItem: (shopKind: ShopKind, itemId: ItemId, amount: number) => boolean;
  // Removes `amount` units of a warehouse item outright — no shelf involved,
  // unlike stockItem. Used for delivering a crafted item to the visiting
  // merchant to fulfill a 'merchantDeliver' job request (see useWorldStore's
  // deliverToMerchant). Returns false if the warehouse doesn't have enough.
  consumeItems: (itemId: ItemId, amount: number) => boolean;
  // Adds `amount` units of an item straight into the warehouse, no cost —
  // the inverse of consumeItems. Used when a bird's house food stock (see
  // HouseInventoryModal) is withdrawn back into the shared warehouse; the
  // item was already paid for once when it was originally deposited.
  addItems: (itemId: ItemId, amount: number) => void;
  // Background NPC restock for feed-shop commodity staples: adds straight
  // to the shelf (bypassing the crafted-goods warehouse) at a cost to gold.
  restockShopItem: (shopKind: ShopKind, itemId: ItemId, amount: number, unitCost: number) => void;
  // A bird buying `amount` units off a shop's shelf for `totalRevenue` gold.
  // Decrements the shelf (clamped at 0) and credits the sale as shop toll.
  fulfillShopPurchase: (shopKind: ShopKind, itemId: ItemId, amount: number, totalRevenue: number) => void;
}

type PlayerStore = PlayerState & PlayerActions;

const initialState: PlayerState = {
  gold: STARTING_GOLD,
  materials: { ...STARTING_MATERIALS },
  items: {},
  shopStock: { general: {}, feed: {}, weapon: {}, armor: {} },
  tollFromHunt: 0,
  tollFromFood: 0,
  tollFromTraveler: 0,
  tollFromShop: 0,
  tollFromMerchant: 0,
  expenseFeedRestock: 0,
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
      creditShopToll: (amount) => set((s) => ({ gold: s.gold + amount, tollFromShop: s.tollFromShop + amount })),
      creditMerchantToll: (amount) =>
        set((s) => ({ gold: s.gold + amount, tollFromMerchant: s.tollFromMerchant + amount })),

      sellMaterialToMerchant: (materialId, amount) => {
        const { materials } = get();
        const have = materials[materialId] ?? 0;
        // Clamped, not rejected outright — a stale UI amount (e.g. another
        // sale already went through) just sells whatever's actually left
        // instead of failing the whole action.
        const sold = Math.max(0, Math.min(amount, have));
        if (sold <= 0) return 0;
        const revenue = sold * MATERIAL_SELL_PRICE[materialId];
        set((s) => ({
          materials: { ...s.materials, [materialId]: (s.materials[materialId] ?? 0) - sold },
          gold: s.gold + revenue,
          tollFromMerchant: s.tollFromMerchant + revenue,
        }));
        return revenue;
      },

      craftItem: (recipeId) => {
        const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
        if (!recipe) return false;
        // Enforced here too, not just by CraftingPanel hiding the button —
        // a recipe not yet unlocked (see useRecipeStore) simply can't be
        // crafted, full stop.
        if (!useRecipeStore.getState().isRecipeUnlocked(recipeId)) return false;
        const { materials, items } = get();
        const canAfford = (Object.entries(recipe.materialCost) as [MaterialId, number][]).every(
          ([materialId, amount]) => (materials[materialId] ?? 0) >= amount
        );
        if (!canAfford) return false;

        const nextMaterials = { ...materials };
        (Object.entries(recipe.materialCost) as [MaterialId, number][]).forEach(([materialId, amount]) => {
          nextMaterials[materialId] = (nextMaterials[materialId] ?? 0) - amount;
        });
        const nextItems = { ...items };
        nextItems[recipe.resultItemId] = (nextItems[recipe.resultItemId] ?? 0) + 1;
        set({ materials: nextMaterials, items: nextItems });
        return true;
      },

      stockItem: (shopKind, itemId, amount) => {
        const { items, shopStock } = get();
        if ((items[itemId] ?? 0) < amount) return false;
        const nextItems = { ...items, [itemId]: (items[itemId] ?? 0) - amount };
        const nextShelf = { ...shopStock[shopKind], [itemId]: (shopStock[shopKind][itemId] ?? 0) + amount };
        set({ items: nextItems, shopStock: { ...shopStock, [shopKind]: nextShelf } });
        return true;
      },

      consumeItems: (itemId, amount) => {
        const { items } = get();
        if ((items[itemId] ?? 0) < amount) return false;
        set({ items: { ...items, [itemId]: (items[itemId] ?? 0) - amount } });
        return true;
      },

      addItems: (itemId, amount) => {
        const { items } = get();
        set({ items: { ...items, [itemId]: (items[itemId] ?? 0) + amount } });
      },

      restockShopItem: (shopKind, itemId, amount, unitCost) => {
        const { gold, shopStock, expenseFeedRestock } = get();
        const cost = amount * unitCost;
        const nextShelf = { ...shopStock[shopKind], [itemId]: (shopStock[shopKind][itemId] ?? 0) + amount };
        set({
          gold: gold - cost,
          shopStock: { ...shopStock, [shopKind]: nextShelf },
          expenseFeedRestock: expenseFeedRestock + cost,
        });
      },

      fulfillShopPurchase: (shopKind, itemId, amount, totalRevenue) => {
        const { shopStock, gold, tollFromShop } = get();
        const nextShelf = { ...shopStock[shopKind], [itemId]: Math.max(0, (shopStock[shopKind][itemId] ?? 0) - amount) };
        set({
          shopStock: { ...shopStock, [shopKind]: nextShelf },
          gold: gold + totalRevenue,
          tollFromShop: tollFromShop + totalRevenue,
        });
      },
    }),
    {
      // Bumped from v1: the schema changed (stamina removed, gold is now a
      // currency instead of a material) and old saved data isn't compatible.
      name: 'tororo-dungeon-player-v2',
      storage: createJSONStorage(() => AsyncStorage),
      // zustand's default merge is a shallow `{ ...current, ...persisted }`,
      // so a saved shopStock from before weapon/armor shops existed (just
      // { general, feed }) fully replaces the fresh default's 4-key object —
      // it doesn't get merged key-by-key. Any lookup for the new shop kinds
      // (ShopModal, ai.ts's sell/buy logic) then hit `undefined` and crashed
      // (real-device "Cannot convert undefined value to object" report right
      // after building a weapon shop). Explicitly merging shopStock one
      // level deeper keeps old saves' actual stock while backfilling
      // whichever shop kinds didn't exist yet when the save was made.
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PlayerStore> | undefined;
        return {
          ...currentState,
          ...persisted,
          shopStock: { ...currentState.shopStock, ...persisted?.shopStock },
        };
      },
    }
  )
);
