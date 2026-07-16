import { CosmeticCategory } from '../types';

// Cosmetic "costume" catalog — a look-only slot, entirely separate from the
// stat-bearing weapon/armor/hat/shield system (see types.ts's EquipSlot vs
// CosmeticCategory, and BirdState.cosmeticId). Cropped from a single
// hand-painted reference sheet the request described as "ビビ専用装備" — that
// naming was a labeling mistake in the source material, not an actual
// per-bird restriction: every entry here is shared across all 4 birds.
//
// Correction (real-device report, see this commit): the first pass of this
// catalog just swapped the reference sheet's own crops in as a full-body
// replacement for the bird's own base sprite. That broke in two different
// ways depending on category:
//   - 着ぐるみ/お祝い/テーマ/季節 drew a full bird IN the costume, with that
//     bird's own face/colors baked in (the sheet is nominally "ビビ", so it
//     was literally Vivi's face/colors) — any other bird wearing it showed
//     Vivi's face instead of its own.
//   - おしゃれな服/かわいい服 drew the garment alone with no bird at all —
//     equipping one made the bird disappear, just a floating dress.
// Fixed by converting every item into a costume-*only* asset (masking out
// whichever bird was baked into the first 8 — see the git history for the
// per-item alpha masks that job needed, since a simple color-based cutout
// wasn't reliable given how much the "keep" and "discard" regions overlapped
// in tone) and layering it on top of the wearer's OWN base sprite at
// render time (CharacterAvatar) instead of replacing it. Any bird's own
// face/color now always shows through whatever hole/gap the costume has.
export interface CosmeticItemDef {
  id: string;
  name: string;
  category: CosmeticCategory;
  // Costume-only art (no bird baked in) — a hood/hat/cape/dress with a
  // transparent gap wherever the wearer's own face or body should show.
  imageAsset: number;
  // Where/how big to draw imageAsset when layered on top of a 256x256 base
  // sprite (assets/birds/*/base.png's own canvas convention — see that
  // folder's README for foot-line/center conventions the two share).
  // widthFrac/heightFrac size the image as a fraction of the render size;
  // centerXFrac/centerYFrac place its center the same way. Derived by
  // compositing each item over vivi/base.png (the sheet's own nominal
  // reference bird) and tuning by eye, then confirmed unchanged on a
  // different-colored bird (haku) since all 4 base sprites share the same
  // proportions/anchor.
  widthFrac: number;
  heightFrac: number;
  centerXFrac: number;
  centerYFrac: number;
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
export const COSMETIC_ITEMS: CosmeticItemDef[] = [
  {
    id: 'costume_parrot',
    name: 'おおきなインコ',
    category: 'costume',
    imageAsset: require('../../assets/cosmetics/costume_parrot.png'),
    widthFrac: 0.7227,
    heightFrac: 0.8527,
    centerXFrac: 0.5,
    centerYFrac: 0.3047,
  },
  {
    id: 'costume_penguin',
    name: 'ペンギン',
    category: 'costume',
    imageAsset: require('../../assets/cosmetics/costume_penguin.png'),
    widthFrac: 0.8203,
    heightFrac: 0.9878,
    centerXFrac: 0.5,
    centerYFrac: 0.4219,
  },
  {
    id: 'outfit_flower_dress',
    name: 'お花のワンピース',
    category: 'outfit',
    imageAsset: require('../../assets/cosmetics/outfit_flower_dress.png'),
    widthFrac: 0.7422,
    heightFrac: 0.6386,
    centerXFrac: 0.5,
    centerYFrac: 0.6445,
  },
  {
    id: 'outfit_sailor',
    name: 'セーラー服',
    category: 'outfit',
    imageAsset: require('../../assets/cosmetics/outfit_sailor.png'),
    widthFrac: 0.7422,
    heightFrac: 0.7645,
    centerXFrac: 0.5,
    centerYFrac: 0.6445,
  },
  {
    id: 'cute_leaf_tunic',
    name: 'リーフチュニック',
    category: 'cute',
    imageAsset: require('../../assets/cosmetics/cute_leaf_tunic.png'),
    widthFrac: 0.7422,
    heightFrac: 0.6494,
    centerXFrac: 0.5,
    centerYFrac: 0.6445,
  },
  {
    id: 'cute_fluffy_sweater',
    name: 'ふわふわセーター',
    category: 'cute',
    imageAsset: require('../../assets/cosmetics/cute_fluffy_sweater.png'),
    widthFrac: 0.7422,
    heightFrac: 0.7002,
    centerXFrac: 0.5,
    centerYFrac: 0.6445,
  },
  {
    id: 'event_party_dress',
    name: 'パーティードレス',
    category: 'event',
    imageAsset: require('../../assets/cosmetics/event_party_dress.png'),
    widthFrac: 0.7617,
    heightFrac: 0.7761,
    centerXFrac: 0.5,
    centerYFrac: 0.5859,
  },
  {
    id: 'event_santa_cape',
    name: 'サンタケープ',
    category: 'event',
    imageAsset: require('../../assets/cosmetics/event_santa_cape.png'),
    widthFrac: 0.7617,
    heightFrac: 0.931,
    centerXFrac: 0.5,
    centerYFrac: 0.5859,
  },
  {
    id: 'theme_ladybug',
    name: 'てんとう虫',
    category: 'theme',
    imageAsset: require('../../assets/cosmetics/theme_ladybug.png'),
    widthFrac: 0.7617,
    heightFrac: 0.9208,
    centerXFrac: 0.5,
    centerYFrac: 0.5859,
  },
  {
    id: 'theme_sunflower',
    name: 'ひまわり',
    category: 'theme',
    imageAsset: require('../../assets/cosmetics/theme_sunflower.png'),
    widthFrac: 0.7227,
    heightFrac: 0.8869,
    centerXFrac: 0.5,
    centerYFrac: 0.2344,
  },
  {
    id: 'seasonal_spring',
    name: '春(桜)',
    category: 'seasonal',
    imageAsset: require('../../assets/cosmetics/seasonal_spring.png'),
    widthFrac: 0.7617,
    heightFrac: 0.8098,
    centerXFrac: 0.5,
    centerYFrac: 0.5859,
  },
  {
    id: 'seasonal_winter',
    name: '冬(雪だるま)',
    category: 'seasonal',
    imageAsset: require('../../assets/cosmetics/seasonal_winter.png'),
    widthFrac: 0.7617,
    heightFrac: 0.904,
    centerXFrac: 0.5,
    centerYFrac: 0.5859,
  },
];

export const COSMETIC_ITEM_MAP: Record<string, CosmeticItemDef> = Object.fromEntries(
  COSMETIC_ITEMS.map((item) => [item.id, item])
);

export function getCosmeticDef(cosmeticId: string | null): CosmeticItemDef | null {
  if (!cosmeticId) return null;
  return COSMETIC_ITEM_MAP[cosmeticId] ?? null;
}
