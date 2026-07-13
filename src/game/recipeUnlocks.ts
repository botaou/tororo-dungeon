import { CRAFTING_RECIPES } from '../data/recipes';
import { ITEM_DEF_MAP } from '../data/items';
import { RecipeSource } from '../types';
import { useRecipeStore } from '../store/useRecipeStore';

function pickLockedRecipeId(): string | null {
  const unlocked = useRecipeStore.getState().unlockedRecipeIds;
  const locked = CRAFTING_RECIPES.filter((r) => !unlocked.includes(r.id));
  if (locked.length === 0) return null;
  return locked[Math.floor(Math.random() * locked.length)].id;
}

// Rolls `chance`; on success, unlocks a random still-locked recipe and
// returns {recipeId, itemName} for logging/notification. Returns null both
// on a missed roll and when every recipe is already unlocked (nothing left
// to discover isn't an error, the routes just quietly stop firing).
export function maybeUnlockRandomRecipe(chance: number, source: RecipeSource): { recipeId: string; itemName: string } | null {
  if (Math.random() >= chance) return null;
  const recipeId = pickLockedRecipeId();
  if (!recipeId) return null;
  if (!useRecipeStore.getState().unlockRecipe(recipeId, source)) return null;
  const recipe = CRAFTING_RECIPES.find((r) => r.id === recipeId)!;
  return { recipeId, itemName: ITEM_DEF_MAP[recipe.resultItemId].name };
}

// The merchant route is player-initiated (see MerchantModal), so unlike the
// other 3 routes this only picks a *candidate* + price — the actual unlock
// happens later, if/when the player spends the gold (see useWorldStore's
// buyMerchantRecipe).
export function rollMerchantRecipeOffer(): { recipeId: string; price: number } | null {
  const recipeId = pickLockedRecipeId();
  if (!recipeId) return null;
  return { recipeId, price: 120 + Math.floor(Math.random() * 80) };
}
