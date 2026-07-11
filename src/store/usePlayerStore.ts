import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ItemId, MaterialId, PlayerState, ShopKind } from '../types';
import { STARTING_GOLD, STARTING_MATERIALS } from '../game/config';
import { CRAFTING_RECIPES } from '../data/recipes';

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
  // The town's 50% cut of a bird's convertible-item sale to the visiting
  // merchant (the "market usage fee").
  creditMerchantToll: (amount: number) => void;
  // The player's main hands-on action: spend the recipe's material cost
  // out of the town warehouse to produce one crafted item. Returns false
  // (no state change) if the town doesn't have enough of any material.
  craftItem: (recipeId: string) => boolean;
  // Move `amount` units of a warehouse item onto a shop's shelf, making it
  // actually purchasable. Returns false if the warehouse doesn't have enough.
  stockItem: (shopKind: ShopKind, itemId: ItemId, amount: number) => boolean;
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
  shopStock: { general: {}, feed: {} },
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

      craftItem: (recipeId) => {
        const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
        if (!recipe) return false;
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
    }
  )
);
