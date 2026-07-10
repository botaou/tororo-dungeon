import { ItemId, MaterialId } from '../types';

// The player's main hands-on action: turn materials bought from birds into
// gear the shop can sell. A small, fixed catalog for now — recipes always
// cost materials only (no gold), and always produce exactly one item.
export interface CraftingRecipe {
  id: string;
  resultItemId: ItemId;
  materialCost: Partial<Record<MaterialId, number>>;
}

export const CRAFTING_RECIPES: CraftingRecipe[] = [
  { id: 'craft_rustySword', resultItemId: 'rustySword', materialCost: { wood: 5, ore: 3 } },
  { id: 'craft_leatherArmor', resultItemId: 'leatherArmor', materialCost: { feather: 4, herb: 3 } },
  { id: 'craft_leatherHat', resultItemId: 'leatherHat', materialCost: { feather: 3, herb: 2 } },
  { id: 'craft_woodenShield', resultItemId: 'woodenShield', materialCost: { wood: 4, ore: 2 } },
  { id: 'craft_luckyCharm', resultItemId: 'luckyCharm', materialCost: { gem: 2, oldCoin: 3 } },

  // Premium feed — shelved at the feed shop once crafted, same as the
  // items above are shelved at the general shop.
  { id: 'craft_nutritionBiscuit', resultItemId: 'nutritionBiscuit', materialCost: { berry: 4, herb: 2 } },
  { id: 'craft_deluxeBlend', resultItemId: 'deluxeBlend', materialCost: { mushroom: 3, berry: 2, feather: 2 } },
  { id: 'craft_energyPellet', resultItemId: 'energyPellet', materialCost: { mushroom: 4, coal: 2 } },
  { id: 'craft_luckyTreat', resultItemId: 'luckyTreat', materialCost: { oldCoin: 2, gem: 1 } },
];
