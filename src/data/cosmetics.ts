import { CosmeticCategory } from '../types';

// Cosmetic "costume" catalog — a look-only slot, entirely separate from the
// stat-bearing weapon/armor/hat/shield system (see types.ts's EquipSlot vs
// CosmeticCategory, and BirdState.cosmeticId). Cropped from a single
// hand-painted reference sheet the request described as "ビビ専用装備" — that
// naming was a labeling mistake in the source material, not an actual
// per-bird restriction: every entry here is shared across all 4 birds (one
// image, reused as-is regardless of which bird has it equipped), matching
// the request's own "1種類の絵を全鳥に使い回す" instruction.
export interface CosmeticItemDef {
  id: string;
  name: string;
  category: CosmeticCategory;
  // A full standing-bird illustration (like assets/birds/*/base.png), not a
  // transparent overlay — see CharacterAvatar, which swaps this in for the
  // bird's own base sprite wholesale rather than layering it on top. The
  // reference sheet draws every costume this way (the same 256x256,
  // centered, bottom-anchored canvas convention documented in
  // assets/birds/README.md), so no per-bird positioning math is needed.
  imageAsset: number;
}

export const COSMETIC_CATEGORY_LABELS: Record<CosmeticCategory, string> = {
  costume: '着ぐるみ(スペシャル)',
  outfit: 'おしゃれな服',
  cute: 'かわいい服',
  event: 'お祝い・イベント衣装',
  theme: 'テーマ・モチーフ衣装',
  seasonal: '季節の衣装',
};

// A sample of ~2 items per category, not the reference sheet's full set
// (per the request's own "まずは各カテゴリから数点ずつのサンプル実装で構いま
// せん" allowance) — how a player actually *acquires* one (shop/gacha/event)
// is intentionally out of scope for this pass, so every sample here is
// simply available to any bird from the start.
//
// Caveat found while cropping: unlike every other category, the reference
// sheet's「おしゃれな服」and「かわいい服」rows only ever draw the garment on
// its own (no bird inside/peeking out) — every other category (着ぐるみ・お
// 祝い・テーマ・季節) shows a full bird wearing the piece. That's a real gap
// in the provided art, not a cropping mistake: equipping 'outfit'/'cute'
// items will visibly show just the garment where the bird normally stands.
// Flagged rather than silently painted over — replacing these two
// categories' source art (or compositing them onto a base bird sprite,
// which would need its own alignment pass given how different the two art
// styles are) is a separate follow-up if it matters in practice.
export const COSMETIC_ITEMS: CosmeticItemDef[] = [
  { id: 'costume_parrot', name: 'おおきなインコ', category: 'costume', imageAsset: require('../../assets/cosmetics/costume_parrot.png') },
  { id: 'costume_penguin', name: 'ペンギン', category: 'costume', imageAsset: require('../../assets/cosmetics/costume_penguin.png') },

  { id: 'outfit_flower_dress', name: 'お花のワンピース', category: 'outfit', imageAsset: require('../../assets/cosmetics/outfit_flower_dress.png') },
  { id: 'outfit_sailor', name: 'セーラー服', category: 'outfit', imageAsset: require('../../assets/cosmetics/outfit_sailor.png') },

  { id: 'cute_leaf_tunic', name: 'リーフチュニック', category: 'cute', imageAsset: require('../../assets/cosmetics/cute_leaf_tunic.png') },
  { id: 'cute_fluffy_sweater', name: 'ふわふわセーター', category: 'cute', imageAsset: require('../../assets/cosmetics/cute_fluffy_sweater.png') },

  { id: 'event_party_dress', name: 'パーティードレス', category: 'event', imageAsset: require('../../assets/cosmetics/event_party_dress.png') },
  { id: 'event_santa_cape', name: 'サンタケープ', category: 'event', imageAsset: require('../../assets/cosmetics/event_santa_cape.png') },

  { id: 'theme_ladybug', name: 'てんとう虫', category: 'theme', imageAsset: require('../../assets/cosmetics/theme_ladybug.png') },
  { id: 'theme_sunflower', name: 'ひまわり', category: 'theme', imageAsset: require('../../assets/cosmetics/theme_sunflower.png') },

  { id: 'seasonal_spring', name: '春(桜)', category: 'seasonal', imageAsset: require('../../assets/cosmetics/seasonal_spring.png') },
  { id: 'seasonal_winter', name: '冬(雪だるま)', category: 'seasonal', imageAsset: require('../../assets/cosmetics/seasonal_winter.png') },
];

export const COSMETIC_ITEM_MAP: Record<string, CosmeticItemDef> = Object.fromEntries(
  COSMETIC_ITEMS.map((item) => [item.id, item])
);

export function getCosmeticDef(cosmeticId: string | null): CosmeticItemDef | null {
  if (!cosmeticId) return null;
  return COSMETIC_ITEM_MAP[cosmeticId] ?? null;
}
