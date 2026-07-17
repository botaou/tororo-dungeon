import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CRAFTING_RECIPES } from '../data/recipes';
import { COSTUME_RECIPES } from '../data/costumeRecipes';
import { RecipeSource } from '../types';

// Recipe ids are just plain strings, so a costume recipe (data/
// costumeRecipes.ts) can share this same store/pool as an item recipe
// (data/recipes.ts) without any special-casing here — both arrays are only
// ever consulted for "does this id exist" and "what unlocks by default".
const ALL_RECIPE_IDS = [...CRAFTING_RECIPES.map((r) => r.id), ...COSTUME_RECIPES.map((r) => r.id)];

interface RecipeState {
  // Recipe ids the player can currently craft — starts with just the
  // defaults (see CRAFTING_RECIPES/COSTUME_RECIPES' unlockedByDefault) and
  // only ever grows.
  unlockedRecipeIds: string[];
}

interface RecipeActions {
  isRecipeUnlocked: (recipeId: string) => boolean;
  // Returns true if this call newly unlocked the recipe (false if it was
  // already unlocked, or the id doesn't exist) — callers use this to decide
  // whether to log/notify.
  unlockRecipe: (recipeId: string, source: RecipeSource) => boolean;
}

export const useRecipeStore = create<RecipeState & RecipeActions>()(
  persist(
    (set, get) => ({
      unlockedRecipeIds: [
        ...CRAFTING_RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id),
        ...COSTUME_RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id),
      ],

      isRecipeUnlocked: (recipeId) => get().unlockedRecipeIds.includes(recipeId),

      unlockRecipe: (recipeId, _source) => {
        if (!ALL_RECIPE_IDS.includes(recipeId)) return false;
        if (get().unlockedRecipeIds.includes(recipeId)) return false;
        set({ unlockedRecipeIds: [...get().unlockedRecipeIds, recipeId] });
        return true;
      },
    }),
    {
      name: 'tororo-dungeon-recipe-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // Without this, an existing save's persisted unlockedRecipeIds fully
      // replaces the freshly-computed default list on rehydrate — so a
      // recipe added later with unlockedByDefault:true (like this pass's 9
      // new tier-1 equipment recipes) would never reach an existing tester,
      // staying locked forever unless some other unlock route happened to
      // roll it. Merging keeps everything the player already unlocked and
      // adds in any new defaults they don't have yet.
      merge: (persisted, current) => {
        const persistedIds = (persisted as Partial<RecipeState>)?.unlockedRecipeIds ?? [];
        return { ...current, unlockedRecipeIds: Array.from(new Set([...current.unlockedRecipeIds, ...persistedIds])) };
      },
    }
  )
);
