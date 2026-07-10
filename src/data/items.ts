import { ItemId } from '../types';

export type ItemCategory = 'weapon' | 'armor' | 'rare';

export interface ItemDef {
  id: ItemId;
  name: string;
  category: ItemCategory;
  emoji: string;
}

// Small hand-picked catalog of monster-dropped loot. Not tied to the
// crafting recipes' outputs (those get their own catalog) — this is just
// what a kill can drop straight into the winning bird's pocket.
export const ITEM_DEFS: ItemDef[] = [
  { id: 'rustySword', name: 'さびた剣', category: 'weapon', emoji: '🗡️' },
  { id: 'leatherArmor', name: '革の鎧', category: 'armor', emoji: '🛡️' },
  { id: 'luckyCharm', name: '幸運のお守り', category: 'rare', emoji: '🍀' },
  { id: 'ancientGem', name: '古代の宝石', category: 'rare', emoji: '💎' },
];

export const ITEM_DEF_MAP: Record<ItemId, ItemDef> = ITEM_DEFS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<ItemId, ItemDef>
);
