import { CosmeticCategory } from '../types';

// Cosmetic "costume" catalog — a look-only slot, entirely separate from the
// stat-bearing weapon/armor/hat/shield system (see types.ts's EquipSlot vs
// CosmeticCategory, and BirdState.cosmeticId). Cropped from a single
// hand-painted reference sheet the request described as "ビビ専用装備" — that
// naming was a labeling mistake in the source material, not an actual
// per-bird restriction: every entry here is shared across all 4 birds.
//
// Correction #1 (real-device report): the first pass of this catalog just
// swapped the reference sheet's own crops in as a full-body replacement for
// the bird's own base sprite. That broke in two different ways depending on
// category:
//   - 着ぐるみ/お祝い/テーマ/季節 drew a full bird IN the costume, with that
//     bird's own face/colors baked in (the sheet is nominally "ビビ", so it
//     was literally Vivi's face/colors) — any other bird wearing it showed
//     Vivi's face instead of its own.
//   - おしゃれな服/かわいい服 drew the garment alone with no bird at all —
//     equipping one made the bird disappear, just a floating dress.
// Fixed by converting every item into a costume-*only* asset (masking out
// whichever bird was baked into the first 8 — see git history for the
// per-item alpha masks that job needed, since a simple color-based cutout
// wasn't reliable given how much the "keep" and "discard" regions overlapped
// in tone) and layering it on top of the wearer's OWN base sprite at render
// time (CharacterAvatar) instead of replacing it.
//
// Correction #2 (real-device report): the offsetX/offsetY/scale below were
// tuned only by compositing over a bare 256x256 canvas — that missed how
// tight the box actually is in-game (WorldMap's BirdSprite renders this at
// size=44, with a sulk/pickaxe emoji sitting just *outside* the box at
// top:-10/-8), so items scaled close to the box's own edges either clipped
// against those neighbors or just looked crowded. Fixed two ways: (a)
// CharacterAvatar's avatar box now has overflow:'hidden', so nothing can
// ever bleed into a sibling element again regardless of tuning error; (b)
// every item's scale was pulled in ~15% with the same offsets re-verified
// to stay within the box (a couple still clip a px or two of pure
// decoration — a sparkle tip, a hat's very top edge — at this size, judged
// an acceptable trade for not looking cramped).
//
// Correction #3 (real-device report: "おおきなインコ" showing only a head,
// badly offset): costume_parrot.png and theme_sunflower.png's *source PNGs*
// had a lot of dead transparent canvas below/around the actual hood art
// (e.g. parrot was a 150x177 canvas but the hood only occupied the top
// 150x115 — the rest was blank padding). Every other item's source PNG is
// tightly cropped to its content (~97-100% of the canvas is opaque), so its
// stored aspect (raw canvas height/width) matches the art's own shape. For
// these two it didn't: the stored aspect described a taller box than the
// art actually needed, so the tuned offsetY (meant to center the *art*)
// ended up centering a box whose bottom third was invisible padding,
// shifting the visible hood too high and clipping it against
// overflow:hidden. Fixed by cropping both PNGs to their true content
// bounds and re-deriving scale/aspect/offsetY from the cropped art. Any
// future costume source art should be cropped the same way before its
// aspect is measured.
export interface CosmeticItemDef {
  id: string;
  name: string;
  category: CosmeticCategory;
  // Costume-only art (no bird baked in) — a hood/hat/cape/dress with a
  // transparent gap wherever the wearer's own face or body should show.
  imageAsset: number;
  // Position/size on the avatar box, independently tunable per item (see
  // this file's "Correction #2" note above for why each of these needed
  // its own value rather than one shared constant). scale is the image's
  // rendered width as a fraction of the box size; height follows from the
  // asset's own native aspect ratio (aspect = native height/width) so it's
  // never distorted. offsetX/offsetY place the image's center relative to
  // the box's own center, also as a fraction of box size (0 = centered).
  scale: number;
  aspect: number;
  offsetX: number;
  offsetY: number;
  // Whether every save starts with this costume already wearable. Only 1-2
  // items should be true — everything else needs to be found while
  // gathering, dropped by an enemy, crafted, or gifted in by the player
  // (see useCosmeticStore, game/cosmeticUnlocks.ts) before it can be worn.
  unlockedByDefault: boolean;
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
// せん" allowance).
export const COSMETIC_ITEMS: CosmeticItemDef[] = [
  {
    id: 'costume_parrot',
    name: 'おおきなインコ',
    category: 'costume',
    imageAsset: require('../../assets/cosmetics/costume_parrot.png'),
    scale: 0.72,
    aspect: 0.7718,
    offsetX: 0,
    offsetY: -0.13,
    unlockedByDefault: true,
  },
  {
    id: 'costume_penguin',
    name: 'ペンギン',
    category: 'costume',
    imageAsset: require('../../assets/cosmetics/costume_penguin.png'),
    scale: 0.6973,
    aspect: 1.2042,
    offsetX: 0,
    offsetY: -0.0781,
    unlockedByDefault: false,
  },
  {
    id: 'outfit_flower_dress',
    name: 'お花のワンピース',
    category: 'outfit',
    imageAsset: require('../../assets/cosmetics/outfit_flower_dress.png'),
    scale: 0.6309,
    aspect: 0.8604,
    offsetX: 0,
    offsetY: 0.1445,
    unlockedByDefault: true,
  },
  {
    id: 'outfit_sailor',
    name: 'セーラー服',
    category: 'outfit',
    imageAsset: require('../../assets/cosmetics/outfit_sailor.png'),
    scale: 0.6309,
    aspect: 1.03,
    offsetX: 0,
    offsetY: 0.1445,
    unlockedByDefault: false,
  },
  {
    id: 'cute_leaf_tunic',
    name: 'リーフチュニック',
    category: 'cute',
    imageAsset: require('../../assets/cosmetics/cute_leaf_tunic.png'),
    scale: 0.6309,
    aspect: 0.875,
    offsetX: 0,
    offsetY: 0.1445,
    unlockedByDefault: false,
  },
  {
    id: 'cute_fluffy_sweater',
    name: 'ふわふわセーター',
    category: 'cute',
    imageAsset: require('../../assets/cosmetics/cute_fluffy_sweater.png'),
    scale: 0.6309,
    aspect: 0.9434,
    offsetX: 0,
    offsetY: 0.1445,
    unlockedByDefault: false,
  },
  {
    id: 'event_party_dress',
    name: 'パーティードレス',
    category: 'event',
    imageAsset: require('../../assets/cosmetics/event_party_dress.png'),
    scale: 0.6474,
    aspect: 1.0189,
    offsetX: 0,
    offsetY: 0.0859,
    unlockedByDefault: false,
  },
  {
    id: 'event_santa_cape',
    name: 'サンタケープ',
    category: 'event',
    imageAsset: require('../../assets/cosmetics/event_santa_cape.png'),
    scale: 0.6474,
    aspect: 1.2223,
    offsetX: 0,
    offsetY: 0.0859,
    unlockedByDefault: false,
  },
  {
    id: 'theme_ladybug',
    name: 'てんとう虫',
    category: 'theme',
    imageAsset: require('../../assets/cosmetics/theme_ladybug.png'),
    scale: 0.6474,
    aspect: 1.2089,
    offsetX: 0,
    offsetY: 0.0859,
    unlockedByDefault: false,
  },
  {
    id: 'theme_sunflower',
    name: 'ひまわり',
    category: 'theme',
    imageAsset: require('../../assets/cosmetics/theme_sunflower.png'),
    scale: 0.85,
    aspect: 0.5652,
    offsetX: 0,
    offsetY: -0.32,
    unlockedByDefault: false,
  },
  {
    id: 'seasonal_spring',
    name: '春(桜)',
    category: 'seasonal',
    imageAsset: require('../../assets/cosmetics/seasonal_spring.png'),
    scale: 0.6474,
    aspect: 1.0631,
    offsetX: 0,
    offsetY: 0.0859,
    unlockedByDefault: false,
  },
  {
    id: 'seasonal_winter',
    name: '冬(雪だるま)',
    category: 'seasonal',
    imageAsset: require('../../assets/cosmetics/seasonal_winter.png'),
    scale: 0.6474,
    aspect: 1.1868,
    offsetX: 0,
    offsetY: 0.0859,
    unlockedByDefault: false,
  },
];

export const COSMETIC_ITEM_MAP: Record<string, CosmeticItemDef> = Object.fromEntries(
  COSMETIC_ITEMS.map((item) => [item.id, item])
);

export function getCosmeticDef(cosmeticId: string | null): CosmeticItemDef | null {
  if (!cosmeticId) return null;
  return COSMETIC_ITEM_MAP[cosmeticId] ?? null;
}
