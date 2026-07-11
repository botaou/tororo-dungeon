import { ItemCategory, ShopKind } from '../types';

export interface ShopDef {
  id: ShopKind;
  name: string;
  emoji: string;
  categories: ItemCategory[];
}

// Two shop kinds so far — a general goods store (weapons/armor) and a feed
// shop (food). Adding a third kind later is just another entry here plus a
// town plot to place it on (see data/townGrid.ts SHOP_PLOT_IDS). 'rare' isn't
// listed for either: convertible treasure never sits on a player-run shop
// shelf, it only ever passes through the visiting merchant (see
// data/items.ts's CONVERTIBLE_ITEM_IDS).
export const SHOP_DEFS: Record<ShopKind, ShopDef> = {
  general: { id: 'general', name: '道具屋', emoji: '🛠️', categories: ['weapon', 'armor', 'hat', 'shield'] },
  feed: { id: 'feed', name: '餌屋', emoji: '🌾', categories: ['food'] },
};
