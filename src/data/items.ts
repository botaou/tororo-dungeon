import { ItemCategory, ItemEffects, ItemId, ItemStatBonus, ItemType, Rarity, WeaponType } from '../types';

// Correction (equipment expansion — see stat_equipment_reference.png in
// this session's uploads): the original 4-item weapon/armor/hat/shield
// catalog is replaced by 5 weapon lines (sword/staff/bow/hammer/knuckle,
// one shared `weapon` slot — a bird equips exactly one, matching the
// request's own "5系統のうち1つを選んで装備") and a 4-slot armor layout
// (head/body/hand/foot — the reference sheet has no shield-equivalent slot
// at all, so `woodenShield` was folded into `hand` rather than kept as a
// 5th slot with only one item ever in it). Each line/slot gets 4 tiers for
// this pass, normal→rare — epic/legendary/mythic tiers and the reference
// sheet's separate "変わり種武器"/"伝説の武器" rows are deliberately out of
// scope, per the request's own staged rollout.
//
// The original 4 items (rustySword/leatherArmor/leatherHat/woodenShield)
// keep their ids/stats/prices exactly as they were — they're simply
// recategorized to slot into this new tier chain as each line's tier-2
// entry, so every existing reference to them (recipes, job presets, drop
// tables) kept working unchanged.
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
  // Present only on equippable items (weapon/head/body/hand/foot) — added
  // to the wearer's base stats while equipped (see game/birdStats.ts).
  statBonus?: ItemStatBonus;
  // Present on every equippable item — drives the rarity-colored star chip
  // shown wherever gear is listed (see RARITY_COLORS/RARITY_LABELS below).
  // 'normal' for everything else (food/rare treasure aren't really "items
  // with a rarity tier" the way gear is, but the field needs a value).
  rarity: Rarity;
  // Present only on `weapon`-category items — which of the 5 lines this
  // belongs to (display/flavor only, see types.ts's WeaponType comment).
  weaponType?: WeaponType;
  // Present only on items that belong to an EquipmentSetDef (see
  // data/equipmentSets.ts) — most gear has no set at all.
  setId?: string;
  // Forward-looking, currently-unused hook for a future look change when
  // this item is equipped (e.g. a sprite overlay/recolor key). Present so
  // that pass doesn't need a schema change either.
  spriteVariant?: string;
}

export const RARITY_ORDER: Rarity[] = ['normal', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITY_LABELS: Record<Rarity, string> = {
  normal: 'ノーマル',
  uncommon: 'アンコモン',
  rare: 'レア',
  epic: 'エピック',
  legendary: 'レジェンダリー',
  mythic: '神話級',
};

// Matches stat_equipment_reference.png's own rarity-star legend.
export const RARITY_COLORS: Record<Rarity, string> = {
  normal: '#B0B0B0',
  uncommon: '#4CAF50',
  rare: '#4A90D9',
  epic: '#9B59B6',
  legendary: '#F5A623',
  mythic: '#E85D75',
};

export const WEAPON_TYPE_LABELS: Record<WeaponType, string> = {
  sword: '剣',
  staff: '杖',
  bow: '弓',
  hammer: 'ハンマー',
  knuckle: 'ナックル',
};

// Small hand-picked catalog of monster-dropped loot and shop goods. Not
// tied 1:1 to crafting recipes' outputs — some items (ancientGem) are
// drop-only, some (seed, etc.) are restock-only, most weapon/armor/rare +
// premium food items are both craftable and drop-able... except drops here
// currently only produce a handful of the tiers (see data/world.ts).
export const ITEM_DEFS: ItemDef[] = [
  // ---- 剣 (sword) ----
  { id: 'swordTraining', name: '訓練用の剣', category: 'weapon', weaponType: 'sword', itemType: 'craft', emoji: '🗡️', buyPrice: 25, rarity: 'normal', statBonus: { atk: 2 } },
  { id: 'rustySword', name: 'さびた剣', category: 'weapon', weaponType: 'sword', itemType: 'craft', emoji: '🗡️', buyPrice: 60, rarity: 'normal', statBonus: { atk: 3 } },
  { id: 'swordSilver', name: '銀の剣', category: 'weapon', weaponType: 'sword', itemType: 'craft', emoji: '⚔️', buyPrice: 140, rarity: 'uncommon', statBonus: { atk: 5, cri: 3 } },
  { id: 'swordFlame', name: '炎の剣', category: 'weapon', weaponType: 'sword', itemType: 'craft', emoji: '🔥', buyPrice: 260, rarity: 'rare', statBonus: { atk: 8, cri: 5 } },

  // ---- 杖 (staff) — magic-flavored, so mp is its signature bonus ----
  { id: 'staffWood', name: '木の杖', category: 'weapon', weaponType: 'staff', itemType: 'craft', emoji: '🪄', buyPrice: 25, rarity: 'normal', statBonus: { atk: 2, mp: 5 } },
  { id: 'staffFlower', name: '花の杖', category: 'weapon', weaponType: 'staff', itemType: 'craft', emoji: '🌸', buyPrice: 60, rarity: 'normal', statBonus: { atk: 3, mp: 8 } },
  { id: 'staffClover', name: 'クローバーの杖', category: 'weapon', weaponType: 'staff', itemType: 'craft', emoji: '🍀', buyPrice: 140, rarity: 'uncommon', statBonus: { atk: 4, mp: 12, luck: 2 } },
  { id: 'staffStar', name: '星の杖', category: 'weapon', weaponType: 'staff', itemType: 'craft', emoji: '⭐', buyPrice: 260, rarity: 'rare', statBonus: { atk: 6, mp: 18, luck: 3 } },

  // ---- 弓 (bow) — ranged, so cri is its signature bonus ----
  { id: 'bowWood', name: '木の弓', category: 'weapon', weaponType: 'bow', itemType: 'craft', emoji: '🏹', buyPrice: 25, rarity: 'normal', statBonus: { atk: 2, cri: 2 } },
  { id: 'bowHunter', name: '狩人の弓', category: 'weapon', weaponType: 'bow', itemType: 'craft', emoji: '🏹', buyPrice: 60, rarity: 'normal', statBonus: { atk: 3, cri: 3 } },
  { id: 'bowHeart', name: 'ハートの弓', category: 'weapon', weaponType: 'bow', itemType: 'craft', emoji: '💘', buyPrice: 140, rarity: 'uncommon', statBonus: { atk: 5, cri: 5 } },
  { id: 'bowWind', name: '風の弓', category: 'weapon', weaponType: 'bow', itemType: 'craft', emoji: '🌬️', buyPrice: 260, rarity: 'rare', statBonus: { atk: 7, cri: 8 } },

  // ---- ハンマー (hammer) — high raw ATK, no secondary stat ----
  { id: 'hammerWood', name: '木のハンマー', category: 'weapon', weaponType: 'hammer', itemType: 'craft', emoji: '🔨', buyPrice: 25, rarity: 'normal', statBonus: { atk: 3 } },
  { id: 'hammerIron', name: '鉄のハンマー', category: 'weapon', weaponType: 'hammer', itemType: 'craft', emoji: '🔨', buyPrice: 60, rarity: 'normal', statBonus: { atk: 5 } },
  { id: 'hammerAcorn', name: 'どんぐりハンマー', category: 'weapon', weaponType: 'hammer', itemType: 'craft', emoji: '🌰', buyPrice: 140, rarity: 'uncommon', statBonus: { atk: 8 } },
  { id: 'hammerFlower', name: '花のハンマー', category: 'weapon', weaponType: 'hammer', itemType: 'craft', emoji: '🌼', buyPrice: 260, rarity: 'rare', statBonus: { atk: 11 } },

  // ---- ナックル (knuckle, 素手武器) — speed+cri, low raw ATK ----
  { id: 'knuckleCloth', name: '布のナックル', category: 'weapon', weaponType: 'knuckle', itemType: 'craft', emoji: '🥊', buyPrice: 25, rarity: 'normal', statBonus: { atk: 2, speed: 1 } },
  { id: 'knuckleLeather', name: '革のナックル', category: 'weapon', weaponType: 'knuckle', itemType: 'craft', emoji: '🥊', buyPrice: 60, rarity: 'normal', statBonus: { atk: 3, speed: 2 } },
  { id: 'knuckleSpike', name: 'トゲトゲナックル', category: 'weapon', weaponType: 'knuckle', itemType: 'craft', emoji: '🦔', buyPrice: 140, rarity: 'uncommon', statBonus: { atk: 4, speed: 3, cri: 3 } },
  { id: 'knuckleCat', name: '猫の手ナックル', category: 'weapon', weaponType: 'knuckle', itemType: 'craft', emoji: '🐾', buyPrice: 260, rarity: 'rare', statBonus: { atk: 6, speed: 4, cri: 6 } },

  // ---- 頭 (head) ----
  { id: 'headLeaf', name: '葉っぱの帽子', category: 'head', itemType: 'craft', emoji: '🍃', buyPrice: 20, rarity: 'normal', statBonus: { defense: 1 } },
  { id: 'leatherHat', name: '革の帽子', category: 'head', itemType: 'craft', emoji: '🧢', buyPrice: 40, rarity: 'normal', statBonus: { defense: 2 } },
  { id: 'headFlower', name: '花かんむり', category: 'head', itemType: 'craft', emoji: '🌺', buyPrice: 100, rarity: 'uncommon', statBonus: { defense: 3, luck: 2 }, setId: 'forestSet' },
  { id: 'headForest', name: '森のぼうし', category: 'head', itemType: 'craft', emoji: '🌲', buyPrice: 200, rarity: 'rare', statBonus: { defense: 5, eva: 3 }, setId: 'starSet' },

  // ---- 体 (body) ----
  { id: 'bodyCloth', name: '木の服', category: 'body', itemType: 'craft', emoji: '👕', buyPrice: 25, rarity: 'normal', statBonus: { defense: 2 } },
  { id: 'leatherArmor', name: '革の鎧', category: 'body', itemType: 'craft', emoji: '🛡️', buyPrice: 50, rarity: 'normal', statBonus: { defense: 3 } },
  { id: 'bodyTunic', name: '森のチュニック', category: 'body', itemType: 'craft', emoji: '🧥', buyPrice: 110, rarity: 'uncommon', statBonus: { defense: 4, hp: 10 }, setId: 'forestSet' },
  { id: 'bodyDress', name: '花のワンピース', category: 'body', itemType: 'craft', emoji: '👗', buyPrice: 210, rarity: 'rare', statBonus: { defense: 6, hp: 15 }, setId: 'starSet' },

  // ---- 手 (hand) — includes the original woodenShield, repurposed here ----
  { id: 'handCloth', name: '木のてぶくろ', category: 'hand', itemType: 'craft', emoji: '🧤', buyPrice: 20, rarity: 'normal', statBonus: { defense: 1 } },
  { id: 'woodenShield', name: '木の盾', category: 'hand', itemType: 'craft', emoji: '🛡', buyPrice: 55, rarity: 'normal', statBonus: { defense: 4 } },
  { id: 'handMitten', name: 'クローバーのて', category: 'hand', itemType: 'craft', emoji: '🍀', buyPrice: 110, rarity: 'uncommon', statBonus: { defense: 5, speed: 2 }, setId: 'forestSet' },
  { id: 'handFlowerGlove', name: 'お花のグローブ', category: 'hand', itemType: 'craft', emoji: '🌷', buyPrice: 210, rarity: 'rare', statBonus: { defense: 7, cri: 3 }, setId: 'starSet' },

  // ---- 足 (foot) — a brand-new slot, no pre-existing item to reuse ----
  { id: 'footCloth', name: '草のブーツ', category: 'foot', itemType: 'craft', emoji: '👟', buyPrice: 20, rarity: 'normal', statBonus: { speed: 1 } },
  { id: 'footLeather', name: '森のブーツ', category: 'foot', itemType: 'craft', emoji: '👢', buyPrice: 45, rarity: 'normal', statBonus: { speed: 2, defense: 1 } },
  { id: 'footFlower', name: 'クローバーブーツ', category: 'foot', itemType: 'craft', emoji: '🌸', buyPrice: 100, rarity: 'uncommon', statBonus: { speed: 3, eva: 3 }, setId: 'forestSet' },
  { id: 'footForest', name: '星のブーツ', category: 'foot', itemType: 'craft', emoji: '🥾', buyPrice: 200, rarity: 'rare', statBonus: { speed: 5, hp: 10 }, setId: 'starSet' },

  // Convertible treasure — no gameplay use, drop-only, sold to the visiting
  // merchant for a 50/50 gold split with the town (never shelved at a shop,
  // never craftable).
  { id: 'luckyCharm', name: '幸運のお守り', category: 'rare', itemType: 'convertible', emoji: '🍀', buyPrice: 80, rarity: 'normal' },
  { id: 'ancientGem', name: '古代の宝石', category: 'rare', itemType: 'convertible', emoji: '💎', buyPrice: 140, rarity: 'normal' },
  { id: 'goldBar', name: '金塊', category: 'rare', itemType: 'convertible', emoji: '🪙', buyPrice: 220, rarity: 'normal' },
  { id: 'royalJewelry', name: '王家の宝飾品', category: 'rare', itemType: 'convertible', emoji: '👑', buyPrice: 350, rarity: 'normal' },

  // Feed-shop commodity staples — no recipe, restocked by an NPC supplier.
  { id: 'seed', name: 'シード', category: 'food', itemType: 'craft', emoji: '🌱', buyPrice: 5, restockCost: 2, rarity: 'normal' },
  { id: 'milletSpray', name: '粟穂', category: 'food', itemType: 'craft', emoji: '🌾', buyPrice: 6, restockCost: 3, rarity: 'normal' },
  { id: 'nuts', name: '木の実', category: 'food', itemType: 'craft', emoji: '🌰', buyPrice: 7, restockCost: 3, rarity: 'normal' },
  { id: 'vegetable', name: '野菜', category: 'food', itemType: 'craft', emoji: '🥬', buyPrice: 8, restockCost: 4, rarity: 'normal' },

  // Premium feed — crafted by the player, then shelved like weapons/armor.
  {
    id: 'nutritionBiscuit',
    name: '栄養ビスケット',
    category: 'food',
    itemType: 'craft',
    emoji: '🍪',
    buyPrice: 18,
    rarity: 'normal',
    effects: { hpRestorePercent: 10 },
  },
  {
    id: 'deluxeBlend',
    name: '高級ブレンド',
    category: 'food',
    itemType: 'craft',
    emoji: '🌟',
    buyPrice: 22,
    rarity: 'normal',
    effects: { hpRestorePercent: 15 },
  },
  {
    id: 'energyPellet',
    name: '元気ペレット',
    category: 'food',
    itemType: 'craft',
    emoji: '⚡',
    buyPrice: 20,
    rarity: 'normal',
    effects: { expBonusPercent: 10 },
  },
  {
    id: 'luckyTreat',
    name: '幸運のおやつ',
    category: 'food',
    itemType: 'craft',
    emoji: '🍬',
    buyPrice: 26,
    rarity: 'normal',
    effects: { expBonusPercent: 15 },
  },

  // Phase 15③: 食堂(restaurant) — a couple of sample dishes, distinct from
  // the feed shop's everyday/premium feed lines above (same 'food' category,
  // different shop shelf — see data/shops.ts's 'restaurant' entry).
  {
    id: 'gourmetSoup',
    name: '街自慢のスープ',
    category: 'food',
    itemType: 'craft',
    emoji: '🍲',
    buyPrice: 24,
    rarity: 'normal',
    effects: { hpRestorePercent: 12 },
  },
  {
    id: 'sweetPudding',
    name: 'ふるふるプリン',
    category: 'food',
    itemType: 'craft',
    emoji: '🍮',
    buyPrice: 20,
    rarity: 'normal',
    effects: { expBonusPercent: 8 },
  },

  // Phase 15③: おもちゃ屋(toy shop) — a couple of sample toys, a brand-new
  // 'toy' category (see types.ts's ItemCategory) but otherwise flowing
  // through the exact same warehouse→shop pipeline as every other craft item.
  { id: 'toyBall', name: 'ボールのおもちゃ', category: 'toy', itemType: 'craft', emoji: '🪀', buyPrice: 15, rarity: 'normal' },
  { id: 'toyFeather', name: '羽根のおもちゃ', category: 'toy', itemType: 'craft', emoji: '🧸', buyPrice: 18, rarity: 'normal' },
];

// Convertible items the merchant will buy off birds — derived rather than
// hand-listed so adding a new treasure item to ITEM_DEFS is the only step
// needed (see game/config.ts's MERCHANT_BUYBACK_SPLIT for the 50/50 split).
export const CONVERTIBLE_ITEM_IDS: ItemId[] = ITEM_DEFS.filter((d) => d.itemType === 'convertible').map((d) => d.id);

// Craft items the merchant's own randomized shelf can be stocked from —
// everything with actual gameplay use. Split into a common pool (normal
// gear/food) and a rare pool (drawn rarely) so the merchant's lineup skews
// toward everyday goods with an occasional standout, without hand-curating
// a separate list from ITEM_DEFS. Now rarity-driven (used to be a 2-item
// hand-picked MERCHANT_RARE_ITEM_IDS list) so the uncommon/rare gear this
// pass added is automatically rarer at the merchant too, not just as common
// as a starter wood-tier item.
export const MERCHANT_COMMON_ITEM_IDS: ItemId[] = ITEM_DEFS.filter(
  (d) => d.itemType === 'craft' && d.category !== 'food' && d.rarity === 'normal'
).map((d) => d.id);
export const MERCHANT_RARE_ITEM_IDS: ItemId[] = ITEM_DEFS.filter(
  (d) => d.itemType === 'craft' && d.category !== 'food' && d.rarity !== 'normal'
).map((d) => d.id);

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
