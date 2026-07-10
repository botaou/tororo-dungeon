import { ItemCategory } from './items';

// One shop kind per definition — deliberately just one entry for now
// (a general goods store), but keyed so a future shop type (weapon shop,
// inn, etc.) is just another entry plus wherever a location picks its kind.
export type ShopKind = 'general';

export interface ShopDef {
  id: ShopKind;
  name: string;
  emoji: string;
  categories: ItemCategory[];
}

export const SHOP_DEFS: Record<ShopKind, ShopDef> = {
  general: { id: 'general', name: '道具屋', emoji: '🛠️', categories: ['weapon', 'armor', 'rare'] },
};

// The town's single shop building is this kind for now.
export const ACTIVE_SHOP: ShopKind = 'general';
