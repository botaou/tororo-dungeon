import { ItemCategory, ShopKind } from '../types';

export interface ShopDef {
  id: ShopKind;
  name: string;
  emoji: string;
  categories: ItemCategory[];
}

// All four kinds require the player to actually construct the matching
// building (data/buildingOptions.ts's general_branch/feed_branch/
// weapon_shop/armor_shop) before it exists anywhere — 'general'/'feed' used
// to have a fixed, always-present town plot from game start (see data/
// townGrid.ts's SHOP_PLOT_IDS comment for why that changed, Phase 12①).
// 'rare' isn't listed for any of these: convertible treasure never sits on
// a player-run shop shelf, it only ever passes through the visiting
// merchant (see data/items.ts's CONVERTIBLE_ITEM_IDS).
//
// head/hand/foot were folded into 'general' rather than each getting (or
// sharing) their own shop kind — the equipment expansion (see data/
// items.ts) quadrupled the armor slot count, and three more shop buildings
// would be a much bigger town-layout change than "sell more gear", so
// 'general' absorbed all three non-body slots the same way it already
// carried both hat and shield before this pass.
export const SHOP_DEFS: Record<ShopKind, ShopDef> = {
  general: { id: 'general', name: '道具屋', emoji: '🛠️', categories: ['head', 'hand', 'foot'] },
  feed: { id: 'feed', name: '餌屋', emoji: '🌾', categories: ['food'] },
  weapon: { id: 'weapon', name: '武器屋', emoji: '⚔️', categories: ['weapon'] },
  armor: { id: 'armor', name: '防具屋', emoji: '🛡️', categories: ['body'] },
};
