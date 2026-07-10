import { ItemCategory, ShopKind } from '../types';

export interface ShopDef {
  id: ShopKind;
  name: string;
  emoji: string;
  categories: ItemCategory[];
}

// Two shop kinds so far — a general goods store (weapons/armor/rare) and a
// feed shop (food). Adding a third kind later is just another entry here
// plus a town plot to place it on (see data/townGrid.ts SHOP_PLOT_IDS).
export const SHOP_DEFS: Record<ShopKind, ShopDef> = {
  general: { id: 'general', name: '道具屋', emoji: '🛠️', categories: ['weapon', 'armor', 'rare'] },
  feed: { id: 'feed', name: '餌屋', emoji: '🌾', categories: ['food'] },
};
