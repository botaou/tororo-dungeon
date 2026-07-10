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
  { id: 'craft_luckyCharm', resultItemId: 'luckyCharm', materialCost: { gem: 2, oldCoin: 3 } },
];
