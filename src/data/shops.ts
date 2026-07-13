import { ItemCategory, ShopKind } from '../types';

export interface ShopDef {
  id: ShopKind;
  name: string;
  emoji: string;
  categories: ItemCategory[];
}

// 'general' (道具屋, hats/shields) and 'feed' (餌屋, food) are the only two
// with a fixed, always-present town plot (see data/townGrid.ts's
// SHOP_PLOT_IDS) — the only shops available from the start. 'weapon' and
// 'armor' have no fixed plot at all; they only exist once the player
// constructs one (see data/buildingOptions.ts's weapon_shop/armor_shop),
// same as a second general/feed branch. 'rare' isn't listed for any of
// these: convertible treasure never sits on a player-run shop shelf, it
// only ever passes through the visiting merchant (see data/items.ts's
// CONVERTIBLE_ITEM_IDS).
export const SHOP_DEFS: Record<ShopKind, ShopDef> = {
  general: { id: 'general', name: '道具屋', emoji: '🛠️', categories: ['hat', 'shield'] },
  feed: { id: 'feed', name: '餌屋', emoji: '🌾', categories: ['food'] },
  weapon: { id: 'weapon', name: '武器屋', emoji: '⚔️', categories: ['weapon'] },
  armor: { id: 'armor', name: '防具屋', emoji: '🛡️', categories: ['armor'] },
};
