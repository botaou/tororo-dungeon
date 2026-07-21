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

  // Equipment expansion (see data/items.ts) — one tier-1 recipe per weapon
  // line/armor slot is unlockedByDefault so every new slot has *something*
  // craftable immediately; every other new tier needs the normal recipe-
  // unlock routes (merchant/gift/quest/combat — see game/recipeUnlocks.ts),
  // same as rustySword/leatherArmor above already did.
  { id: 'craft_swordTraining', resultItemId: 'swordTraining', materialCost: { wood: 3 }, unlockedByDefault: true },
  { id: 'craft_swordSilver', resultItemId: 'swordSilver', materialCost: { ore: 5, gem: 1 }, unlockedByDefault: false },
  { id: 'craft_swordFlame', resultItemId: 'swordFlame', materialCost: { ore: 6, coal: 4, gem: 2 }, unlockedByDefault: false },

  { id: 'craft_staffWood', resultItemId: 'staffWood', materialCost: { wood: 3, herb: 2 }, unlockedByDefault: true },
  { id: 'craft_staffFlower', resultItemId: 'staffFlower', materialCost: { herb: 4, berry: 2 }, unlockedByDefault: false },
  { id: 'craft_staffClover', resultItemId: 'staffClover', materialCost: { berry: 4, gem: 1 }, unlockedByDefault: false },
  { id: 'craft_staffStar', resultItemId: 'staffStar', materialCost: { magicStone: 2, gem: 2, berry: 3 }, unlockedByDefault: false },

  { id: 'craft_bowWood', resultItemId: 'bowWood', materialCost: { wood: 4 }, unlockedByDefault: true },
  { id: 'craft_bowHunter', resultItemId: 'bowHunter', materialCost: { wood: 5, feather: 3 }, unlockedByDefault: false },
  { id: 'craft_bowHeart', resultItemId: 'bowHeart', materialCost: { feather: 5, berry: 3 }, unlockedByDefault: false },
  { id: 'craft_bowWind', resultItemId: 'bowWind', materialCost: { feather: 6, magicStone: 1, gem: 2 }, unlockedByDefault: false },

  { id: 'craft_hammerWood', resultItemId: 'hammerWood', materialCost: { wood: 5 }, unlockedByDefault: true },
  { id: 'craft_hammerIron', resultItemId: 'hammerIron', materialCost: { wood: 4, ore: 5 }, unlockedByDefault: false },
  { id: 'craft_hammerAcorn', resultItemId: 'hammerAcorn', materialCost: { ore: 6, coal: 3 }, unlockedByDefault: false },
  { id: 'craft_hammerFlower', resultItemId: 'hammerFlower', materialCost: { ore: 8, coal: 5, gem: 2 }, unlockedByDefault: false },

  { id: 'craft_knuckleCloth', resultItemId: 'knuckleCloth', materialCost: { feather: 3 }, unlockedByDefault: true },
  { id: 'craft_knuckleLeather', resultItemId: 'knuckleLeather', materialCost: { feather: 4, herb: 2 }, unlockedByDefault: false },
  { id: 'craft_knuckleSpike', resultItemId: 'knuckleSpike', materialCost: { feather: 5, ore: 3 }, unlockedByDefault: false },
  { id: 'craft_knuckleCat', resultItemId: 'knuckleCat', materialCost: { feather: 6, ore: 4, gem: 1 }, unlockedByDefault: false },

  { id: 'craft_headLeaf', resultItemId: 'headLeaf', materialCost: { herb: 3 }, unlockedByDefault: true },
  { id: 'craft_headFlower', resultItemId: 'headFlower', materialCost: { berry: 4, herb: 3 }, unlockedByDefault: false },
  { id: 'craft_headForest', resultItemId: 'headForest', materialCost: { herb: 6, magicStone: 1, berry: 3 }, unlockedByDefault: false },

  { id: 'craft_bodyCloth', resultItemId: 'bodyCloth', materialCost: { herb: 4, wood: 2 }, unlockedByDefault: true },
  { id: 'craft_bodyTunic', resultItemId: 'bodyTunic', materialCost: { herb: 5, feather: 3 }, unlockedByDefault: false },
  { id: 'craft_bodyDress', resultItemId: 'bodyDress', materialCost: { berry: 5, herb: 5, gem: 1 }, unlockedByDefault: false },

  { id: 'craft_handCloth', resultItemId: 'handCloth', materialCost: { herb: 3, wood: 2 }, unlockedByDefault: true },
  { id: 'craft_handMitten', resultItemId: 'handMitten', materialCost: { herb: 4, berry: 3 }, unlockedByDefault: false },
  { id: 'craft_handFlowerGlove', resultItemId: 'handFlowerGlove', materialCost: { berry: 5, herb: 4, gem: 1 }, unlockedByDefault: false },

  { id: 'craft_footCloth', resultItemId: 'footCloth', materialCost: { herb: 3, wood: 2 }, unlockedByDefault: true },
  { id: 'craft_footLeather', resultItemId: 'footLeather', materialCost: { wood: 4, herb: 3 }, unlockedByDefault: false },
  { id: 'craft_footFlower', resultItemId: 'footFlower', materialCost: { berry: 4, herb: 4 }, unlockedByDefault: false },
  { id: 'craft_footForest', resultItemId: 'footForest', materialCost: { herb: 6, magicStone: 1 }, unlockedByDefault: false },

  // Premium feed — shelved at the feed shop once crafted, same as the
  // items above are shelved at the general shop.
  { id: 'craft_nutritionBiscuit', resultItemId: 'nutritionBiscuit', materialCost: { berry: 4, herb: 2 }, unlockedByDefault: true },
  { id: 'craft_deluxeBlend', resultItemId: 'deluxeBlend', materialCost: { mushroom: 3, berry: 2, feather: 2 }, unlockedByDefault: false },
  { id: 'craft_energyPellet', resultItemId: 'energyPellet', materialCost: { mushroom: 4, coal: 2 }, unlockedByDefault: false },
  { id: 'craft_luckyTreat', resultItemId: 'luckyTreat', materialCost: { oldCoin: 2, gem: 1 }, unlockedByDefault: false },

  // Phase 15③: 食堂(restaurant) sample dishes + おもちゃ屋(toy shop) sample
  // toys — both unlockedByDefault so each new shop has something craftable
  // the moment it's built, same precedent as the original 4 equipment-slot
  // defaults (see this file's own comment on `unlockedByDefault` above).
  { id: 'craft_gourmetSoup', resultItemId: 'gourmetSoup', materialCost: { mushroom: 3, berry: 2 }, unlockedByDefault: true },
  { id: 'craft_sweetPudding', resultItemId: 'sweetPudding', materialCost: { berry: 3, herb: 2 }, unlockedByDefault: true },
  { id: 'craft_toyBall', resultItemId: 'toyBall', materialCost: { wood: 3, feather: 2 }, unlockedByDefault: true },
  { id: 'craft_toyFeather', resultItemId: 'toyFeather', materialCost: { feather: 4 }, unlockedByDefault: true },
];
