import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CRAFTING_RECIPES } from '../data/recipes';
import { RecipeSource } from '../types';

interface RecipeState {
  // Recipe ids (CraftingRecipe.id) the player can currently craft — starts
  // with just the defaults (see CRAFTING_RECIPES' unlockedByDefault) and
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
      unlockedRecipeIds: CRAFTING_RECIPES.filter((r) => r.unlockedByDefault).map((r) => r.id),

      isRecipeUnlocked: (recipeId) => get().unlockedRecipeIds.includes(recipeId),

      unlockRecipe: (recipeId, _source) => {
        if (!CRAFTING_RECIPES.some((r) => r.id === recipeId)) return false;
        if (get().unlockedRecipeIds.includes(recipeId)) return false;
        set({ unlockedRecipeIds: [...get().unlockedRecipeIds, recipeId] });
        return true;
      },
    }),
    {
      name: 'tororo-dungeon-recipe-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
