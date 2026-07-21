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
// Phase 15③ shop expansion: 'restaurant' shares the 'food' category with
// 'feed' — CraftingPanel/StockingPanel filter purely by ItemCategory, so
// both shops show the same craftable/shelvable food catalog (same loose
// precedent as 'general' already sharing no fewer than 3 categories at
// once). The one real difference is that ai.ts's stepShopFood only ever
// walks a hungry bird to the 'feed' shop by name — 'restaurant' is a
// player-facing flavor shop (craft/shelve/view), not a second autonomous
// food source. 'toy' is its own category with no bird-side consumer either
// — おもちゃ屋 is decorative/collectible for now, same reasoning.
export const SHOP_DEFS: Record<ShopKind, ShopDef> = {
  general: { id: 'general', name: '道具屋', emoji: '🛠️', categories: ['head', 'hand', 'foot'] },
  feed: { id: 'feed', name: '餌屋', emoji: '🌾', categories: ['food'] },
  weapon: { id: 'weapon', name: '武器屋', emoji: '⚔️', categories: ['weapon'] },
  armor: { id: 'armor', name: '防具屋', emoji: '🛡️', categories: ['body'] },
  // 'clothing'/'furniture'/'mystery' don't use the categories-based shelf at
  // all (see TownScreen's shop-tap dispatch, which opens a dedicated modal
  // for each instead of ShopModal) — categories: [] here purely so every
  // ShopKind still has a well-typed ShopDef entry.
  clothing: { id: 'clothing', name: '服屋', emoji: '👗', categories: [] },
  restaurant: { id: 'restaurant', name: '食堂', emoji: '🍽️', categories: ['food'] },
  furniture: { id: 'furniture', name: '家具屋', emoji: '🪑', categories: [] },
  toy: { id: 'toy', name: 'おもちゃ屋', emoji: '🧸', categories: ['toy'] },
  mystery: { id: 'mystery', name: '怪しいアイテム屋', emoji: '🔮', categories: [] },
};
