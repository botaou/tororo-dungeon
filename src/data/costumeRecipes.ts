import { MaterialId } from '../types';

// The "作る" acquisition route for costumes (see game/cosmeticUnlocks.ts) —
// mirrors data/recipes.ts's CraftingRecipe shape exactly, just pointing at
// a cosmetic id instead of an ItemId. Recipe *unlocking* is shared with the
// item-recipe system (see store/useRecipeStore.ts, which tracks both pools
// in the same unlockedRecipeIds list) — a "you found a new recipe!" event
// from gathering/combat/job-board completion can surface either kind, per
// the request's own "レシピは段階的に解放される既存の仕組みを流用してよい"
// allowance. Crafting one (see usePlayerStore.craftCosmetic) consumes
// materials like any other recipe, but produces a costume *ticket* (see
// useCosmeticStore) rather than an instant unlock — same as the find/drop
// routes, the player still has to gift it to actually wear it.
export interface CostumeRecipe {
  id: string;
  cosmeticId: string;
  materialCost: Partial<Record<MaterialId, number>>;
  unlockedByDefault: boolean;
}

export const COSTUME_RECIPES: CostumeRecipe[] = [
  { id: 'craft_theme_ladybug', cosmeticId: 'theme_ladybug', materialCost: { berry: 5, herb: 3 }, unlockedByDefault: true },
  { id: 'craft_costume_penguin', cosmeticId: 'costume_penguin', materialCost: { feather: 6, gem: 2 }, unlockedByDefault: false },
  {
    id: 'craft_seasonal_spring',
    cosmeticId: 'seasonal_spring',
    materialCost: { berry: 4, waterweed: 2 },
    unlockedByDefault: false,
  },
  {
    id: 'craft_event_santa_cape',
    cosmeticId: 'event_santa_cape',
    materialCost: { wood: 3, feather: 4, coal: 1 },
    unlockedByDefault: false,
  },
];
