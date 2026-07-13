import { ItemId, MaterialId } from '../types';

// The player's main hands-on action: turn materials bought from birds into
// gear the shop can sell. A small, fixed catalog for now — recipes always
// cost materials only (no gold), and always produce exactly one item.
export interface CraftingRecipe {
  id: string;
  resultItemId: ItemId;
  materialCost: Partial<Record<MaterialId, number>>;
  // Whether this recipe is craftable from a fresh save with no further
  // unlocking (see store/useRecipeStore.ts). The 3 defaults were picked to
  // match the two shops available from the start (general's hat/shield,
  // feed's premium food) — rustySword/leatherArmor need both a recipe
  // unlock AND their own shop constructed, so they're deliberately not
  // among the defaults.
  unlockedByDefault: boolean;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  { id: 'craft_rustySword', resultItemId: 'rustySword', materialCost: { wood: 5, ore: 3 }, unlockedByDefault: false },
  { id: 'craft_leatherArmor', resultItemId: 'leatherArmor', materialCost: { feather: 4, herb: 3 }, unlockedByDefault: false },
  { id: 'craft_leatherHat', resultItemId: 'leatherHat', materialCost: { feather: 3, herb: 2 }, unlockedByDefault: true },
  { id: 'craft_woodenShield', resultItemId: 'woodenShield', materialCost: { wood: 4, ore: 2 }, unlockedByDefault: true },

  // Premium feed — shelved at the feed shop once crafted, same as the
  // items above are shelved at the general shop.
  { id: 'craft_nutritionBiscuit', resultItemId: 'nutritionBiscuit', materialCost: { berry: 4, herb: 2 }, unlockedByDefault: true },
  { id: 'craft_deluxeBlend', resultItemId: 'deluxeBlend', materialCost: { mushroom: 3, berry: 2, feather: 2 }, unlockedByDefault: false },
  { id: 'craft_energyPellet', resultItemId: 'energyPellet', materialCost: { mushroom: 4, coal: 2 }, unlockedByDefault: false },
  { id: 'craft_luckyTreat', resultItemId: 'luckyTreat', materialCost: { oldCoin: 2, gem: 1 }, unlockedByDefault: false },
];
