import { ItemCategory, ItemEffects, ItemId, ItemStatBonus, ItemType } from '../types';

export interface ItemDef {
  id: ItemId;
  name: string;
  category: ItemCategory;
  // 'craft' items flow through the normal warehouse→shop pipeline (bought,
  // crafted, or NPC-restocked). 'convertible' items are drop-only treasure
  // that lives solely in a bird's personal `items` until sold to the
  // visiting merchant — for those, `buyPrice` doubles as the sale value
  // split 50/50 between the bird and the town (see MerchantState).
  itemType: ItemType;
  emoji: string;
  // Gold a bird pays when buying this at a shop.
  buyPrice: number;
  // Present only for NPC-restocked commodity goods (feed-shop staples) —
  // the town's wholesale cost per unit, paid to keep the shelf stocked.
  // Crafted items have no restockCost; they cost materials instead (see
  // data/recipes.ts) and are shelved manually once crafted.
  restockCost?: number;
  // Present only on food with a designed bonus in mind — not applied by
  // any gameplay logic yet, just data shaped so a later pass (e.g. "eating
  // this heals X%") doesn't need a schema change.
  effects?: ItemEffects;
  // Present only on equippable items (weapon/armor/hat/shield) — added to
  // the wearer's base stats while equipped (see game/birdStats.ts).
  statBonus?: ItemStatBonus;
  // Forward-looking, currently-unused hook for a future look change when
  // this item is equipped (e.g. a sprite overlay/recolor key). Present so
  // that pass doesn't need a schema change either.
  spriteVariant?: string;
}

// Small hand-picked catalog of monster-dropped loot and shop goods. Not
// tied 1:1 to crafting recipes' outputs — some items (ancientGem) are
// drop-only, some (seed, etc.) are restock-only, most weapon/armor/rare +
// premium food items are both craftable and drop-able... except drops here
// currently only produce the weapon/armor/rare tier (see data/world.ts).
export const ITEM_DEFS: ItemDef[] = [
  { id: 'rustySword', name: 'さびた剣', category: 'weapon', itemType: 'craft', emoji: '🗡️', buyPrice: 60, statBonus: { atk: 3 } },
  { id: 'leatherArmor', name: '革の鎧', category: 'armor', itemType: 'craft', emoji: '🛡️', buyPrice: 50, statBonus: { defense: 3 } },
  { id: 'leatherHat', name: '革の帽子', category: 'hat', itemType: 'craft', emoji: '🧢', buyPrice: 40, statBonus: { defense: 2 } },
  { id: 'woodenShield', name: '木の盾', category: 'shield', itemType: 'craft', emoji: '🛡', buyPrice: 55, statBonus: { defense: 4 } },

  // Convertible treasure — no gameplay use, drop-only, sold to the visiting
  // merchant for a 50/50 gold split with the town (never shelved at a shop,
  // never craftable).
  { id: 'luckyCharm', name: '幸運のお守り', category: 'rare', itemType: 'convertible', emoji: '🍀', buyPrice: 80 },
  { id: 'ancientGem', name: '古代の宝石', category: 'rare', itemType: 'convertible', emoji: '💎', buyPrice: 140 },
  { id: 'goldBar', name: '金塊', category: 'rare', itemType: 'convertible', emoji: '🪙', buyPrice: 220 },
  { id: 'royalJewelry', name: '王家の宝飾品', category: 'rare', itemType: 'convertible', emoji: '👑', buyPrice: 350 },

  // Feed-shop commodity staples — no recipe, restocked by an NPC supplier.
  { id: 'seed', name: 'シード', category: 'food', itemType: 'craft', emoji: '🌱', buyPrice: 5, restockCost: 2 },
  { id: 'milletSpray', name: '粟穂', category: 'food', itemType: 'craft', emoji: '🌾', buyPrice: 6, restockCost: 3 },
  { id: 'nuts', name: '木の実', category: 'food', itemType: 'craft', emoji: '🌰', buyPrice: 7, restockCost: 3 },
  { id: 'vegetable', name: '野菜', category: 'food', itemType: 'craft', emoji: '🥬', buyPrice: 8, restockCost: 4 },

  // Premium feed — crafted by the player, then shelved like weapons/armor.
  {
    id: 'nutritionBiscuit',
    name: '栄養ビスケット',
    category: 'food',
    itemType: 'craft',
    emoji: '🍪',
    buyPrice: 18,
    effects: { hpRestorePercent: 10 },
  },
  {
    id: 'deluxeBlend',
    name: '高級ブレンド',
    category: 'food',
    itemType: 'craft',
    emoji: '🌟',
    buyPrice: 22,
    effects: { hpRestorePercent: 15 },
  },
  {
    id: 'energyPellet',
    name: '元気ペレット',
    category: 'food',
    itemType: 'craft',
    emoji: '⚡',
    buyPrice: 20,
    effects: { expBonusPercent: 10 },
  },
  {
    id: 'luckyTreat',
    name: '幸運のおやつ',
    category: 'food',
    itemType: 'craft',
    emoji: '🍬',
    buyPrice: 26,
    effects: { expBonusPercent: 15 },
  },
];

// Convertible items the merchant will buy off birds — derived rather than
// hand-listed so adding a new treasure item to ITEM_DEFS is the only step
// needed (see game/config.ts's MERCHANT_BUYBACK_SPLIT for the 50/50 split).
export const CONVERTIBLE_ITEM_IDS: ItemId[] = ITEM_DEFS.filter((d) => d.itemType === 'convertible').map((d) => d.id);

// Craft items the merchant's own randomized shelf can be stocked from —
// everything with actual gameplay use. Split into a common pool (normal
// gear/food) and a rare pool (drawn rarely) so the merchant's lineup skews
// toward everyday goods with an occasional standout, without hand-curating
// a separate list from ITEM_DEFS.
export const MERCHANT_COMMON_ITEM_IDS: ItemId[] = ITEM_DEFS.filter(
  (d) => d.itemType === 'craft' && d.category !== 'food'
).map((d) => d.id);
export const MERCHANT_RARE_ITEM_IDS: ItemId[] = ['woodenShield', 'leatherArmor'];

export const ITEM_DEF_MAP: Record<ItemId, ItemDef> = ITEM_DEFS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<ItemId, ItemDef>
);

// Commodity staples the feed shop's NPC supplier keeps in stock — anything
// with a restockCost. Derived rather than hand-listed so adding a new
// commodity item to ITEM_DEFS is the only step needed.
export const RESTOCKED_ITEM_IDS: ItemId[] = ITEM_DEFS.filter((d) => d.restockCost !== undefined).map((d) => d.id);
