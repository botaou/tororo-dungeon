import { CRAFTING_RECIPES } from '../data/recipes';
import { COSTUME_RECIPES } from '../data/costumeRecipes';
import { ITEM_DEF_MAP } from '../data/items';
import { COSMETIC_ITEM_MAP } from '../data/cosmetics';
import { RecipeSource } from '../types';
import { useRecipeStore } from '../store/useRecipeStore';

function pickLockedItemRecipeId(): string | null {
  const unlocked = useRecipeStore.getState().unlockedRecipeIds;
  const locked = CRAFTING_RECIPES.filter((r) => !unlocked.includes(r.id));
  if (locked.length === 0) return null;
  return locked[Math.floor(Math.random() * locked.length)].id;
}

// Combined candidate pool of BOTH item and costume recipes (see
// data/costumeRecipes.ts) — used by the 3 ambient discovery routes below so
// a "found a new recipe!" moment can occasionally surface a costume recipe
// instead of a gear/food one. Kept separate from pickLockedItemRecipeId
// (used only by the merchant's own offer, see rollMerchantRecipeOffer)
// since MerchantModal's display assumes an ItemId result and would silently
// show nothing for a costume recipe id.
function pickLockedAnyRecipeId(): string | null {
  const unlocked = useRecipeStore.getState().unlockedRecipeIds;
  const lockedItems = CRAFTING_RECIPES.filter((r) => !unlocked.includes(r.id)).map((r) => r.id);
  const lockedCostumes = COSTUME_RECIPES.filter((r) => !unlocked.includes(r.id)).map((r) => r.id);
  const locked = [...lockedItems, ...lockedCostumes];
  if (locked.length === 0) return null;
  return locked[Math.floor(Math.random() * locked.length)];
}

// A recipe id's own display name, regardless of which of the two catalogs
// it belongs to.
function recipeResultName(recipeId: string): string {
  const itemRecipe = CRAFTING_RECIPES.find((r) => r.id === recipeId);
  if (itemRecipe) return ITEM_DEF_MAP[itemRecipe.resultItemId].name;
  const costumeRecipe = COSTUME_RECIPES.find((r) => r.id === recipeId);
  if (costumeRecipe) return COSMETIC_ITEM_MAP[costumeRecipe.cosmeticId].name;
  return recipeId;
}

// Rolls `chance`; on success, unlocks a random still-locked recipe (item or
// costume) and returns {recipeId, itemName} for logging/notification.
// Returns null both on a missed roll and when everything is already
// unlocked (nothing left to discover isn't an error, the routes just
// quietly stop firing).
export function maybeUnlockRandomRecipe(chance: number, source: RecipeSource): { recipeId: string; itemName: string } | null {
  if (Math.random() >= chance) return null;
  const recipeId = pickLockedAnyRecipeId();
  if (!recipeId) return null;
  if (!useRecipeStore.getState().unlockRecipe(recipeId, source)) return null;
  return { recipeId, itemName: recipeResultName(recipeId) };
}

// The merchant route is player-initiated (see MerchantModal), so unlike the
// other 3 routes this only picks a *candidate* + price — the actual unlock
// happens later, if/when the player spends the gold (see useWorldStore's
// buyMerchantRecipe). Item recipes only — MerchantModal's offer card reads
// straight from data/recipes.ts/ITEM_DEF_MAP, so a costume recipe id here
// would just render as an empty offer.
export function rollMerchantRecipeOffer(): { recipeId: string; price: number } | null {
  const recipeId = pickLockedItemRecipeId();
  if (!recipeId) return null;
  return { recipeId, price: 120 + Math.floor(Math.random() * 80) };
}
