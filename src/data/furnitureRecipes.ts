import { MaterialId } from '../types';

// Phase 15③: 家具屋(furniture shop)/仕立て屋's own craft route for mayor's-
// room furniture — mirrors data/costumeRecipes.ts's CostumeRecipe shape
// exactly, just producing a furniture defId (see data/furniture.ts) into
// useMayorRoomStore's craftedStock instead of a cosmetic ticket. A sample of
// 2 recipes, per the request's own "各店1〜2種類程度のサンプルで構いません" —
// both unlockedByDefault so the furniture shop has something craftable the
// moment it's built (same precedent as Phase 15③'s restaurant/toy-shop
// recipes).
export interface FurnitureRecipe {
  id: string;
  furnitureDefId: string;
  materialCost: Partial<Record<MaterialId, number>>;
  unlockedByDefault: boolean;
}

export const FURNITURE_RECIPES: FurnitureRecipe[] = [
  { id: 'craft_chair', furnitureDefId: 'chair', materialCost: { wood: 3 }, unlockedByDefault: true },
  { id: 'craft_plant', furnitureDefId: 'plant', materialCost: { herb: 4 }, unlockedByDefault: true },
  { id: 'craft_table', furnitureDefId: 'table', materialCost: { wood: 5 }, unlockedByDefault: false },
  { id: 'craft_bookshelf', furnitureDefId: 'bookshelf', materialCost: { wood: 6, gem: 1 }, unlockedByDefault: false },
  { id: 'craft_mannequin_a', furnitureDefId: 'mannequin_a', materialCost: { feather: 5 }, unlockedByDefault: false },
  { id: 'craft_mannequin_b', furnitureDefId: 'mannequin_b', materialCost: { feather: 4, gem: 2 }, unlockedByDefault: false },
];
