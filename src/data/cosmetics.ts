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
// (e.g. parrot was a 150x177 canvas but the visible art only occupied the
// top 150x115 — the rest was blank padding). Every other item's source PNG
// is tightly cropped to its content (~97-100% of the canvas is opaque), so
// its stored aspect (raw canvas height/width) matches the art's own shape.
// For these two it didn't: the stored aspect described a taller box than
// the art actually needed, so the tuned offsetY (meant to center the *art*)
// ended up centering a box whose bottom third was invisible padding,
// shifting the visible hood too high and clipping it against
// overflow:hidden. Fixed by cropping both PNGs to their true content
// bounds and re-deriving scale/aspect/offsetY from the cropped art.
//
// Correction #4 (real-device report: "このインコは全身の着ぐるみだったはず"):
// correction #3's crop was aimed at the wrong target for costume_parrot.
// Diffing against the pre-Correction-#1 source (git history) showed the
// original reference art was a full-body parrot kigurumi (hood *and*
// wings/tail continuing all the way down, exactly like costume_penguin) —
// Correction #1's baked-in-identity mask had wrongly erased that entire
// lower two-thirds, mistaking the suit's own body for "the plain bird
// underneath" that needed removing. What actually needed removing was only
// the small face circle inside the hood opening (the example bird's own
// face). Re-derived costume_parrot.png from the git-history original,
// masking just that face circle so the full kigurumi body/wings/tail stay
// intact — same treatment costume_penguin already had, so both now share
// its scale/offsetY. (theme_sunflower's original was checked too and, as
// expected from its category being a themed hat rather than a kigurumi
// suit, its original really was just a bird wearing a sunflower-shaped
// hood — the hood-only crop from Correction #3 was correct for it and is
// unchanged here.)
//
// Also from that report: several head-hugging items (event_santa_cape,
// theme_ladybug, event_party_dress, seasonal_spring, seasonal_winter, all
// offsetY 0.0859) covered Vivi's/Mone's eyes while sitting fine on
// Haku/Tororo. The 4 birds' base sprites don't actually share identical
// head proportions within the shared 256x256 convention — measured head-top
// (first opaque row) is y=26 (vivi) / 34 (haku) / 37 (tororo) / 27 (mone),
// a ~4% swing that a hood/hat anchored by a single fixed offsetY can't
// absorb once it's tuned tight enough to hug the eye-line on every bird.
// Shifted those 5 items' offsetY up to 0.03 — clears Vivi/Mone's eyes
// without floating noticeably on Haku/Tororo. If a future head-hugging item
// shows the same bird-dependent misfit, this is why: there's no per-bird
// override in this data shape, only a single compromise value tuned to
// clear the biggest head in the roster.
//
// Correction #5 (real-device report: theme_sunflower still covering Haku's
// eyes; costume_parrot still showing a fragment of the baked-in face on
// real hardware): two more bugs slipped through the previous verification
// pass because it never checked the 48px size BirdRosterModal's header
// avatar actually renders at (only 44/40/32 had been re-checked) — at 48px
// theme_sunflower's scale=0.85/offsetY=-0.32 genuinely did sit low enough
// to cover the eyes on every bird, it just hadn't been looked at closely
// enough at any size to notice. Shrunk it to scale=0.65/offsetY=-0.394 so
// its (fully opaque, no-face-hole) brim clears every bird's eye-line with
// only its petal tips clipping at the top — same trade-off precedent as
// Correction #2. Separately, costume_parrot's face-hole mask (Correction
// #4) was positioned too far right/down, leaving the baked-in bird's own
// eye and cheek untouched on the left edge of the hole — any other bird
// wearing it showed that fragment instead of (or blended with) its own
// face. Widened the mask ellipse to fully cover the original face. Both
// re-verified at all 4 real render sizes (48/44/40/32) across all 4 birds
// this time, not just the sizes checked previously.
// Correction #6 (explicit design request, backed by re-checking the
// original reference sheet — see 6b7dbd20-cosmetic_equipment_reference.png
// in this session's uploads): every item up to this point was rendered the
// same way (full bird sprite drawn underneath, costume art layered on top).
// That's correct for most items, but the reference sheet shows the
// 着ぐるみ(スペシャル) row (costume_parrot/costume_penguin, and — not yet
// implemented — the dinosaur/dragon/unicorn suits) is a genuinely different
// construction: the ENTIRE creature shape (head, wings, tail, feet) is the
// costume's own art, and only a small oval — just the wearer's face and
// cheeks, confirmed by the dinosaur cell where the green suit and the
// wearer's face are obviously different colors — shows through. Drawing
// the wearer's full body underneath (as if it were an 'overlay' item) made
// the real bird's own wings/feet peek out alongside the costume's own,
// looking "stuck together" rather than like one creature.
//
// Checking the OTHER categories against this same reference sheet showed
// they are NOT built this way, despite some (party dress, santa cape,
// ladybug, sunflower, spring, winter) having a similarly large-looking
// transparent opening: in every one of those reference cells the wearer's
// whole body — face, chest, belly, feet — is fully visible, worn under a
// draped garment/hood/cape. Those stay `overlay`.
//
// Correction #7 (user redrew the reference sheet): the 着ぐるみ(スペシャル)
// row's face-hole previously had a specific sample bird's face baked into
// the source art (see Correction #5's "residual face fragment" bug) — no
// matter how tightly the mask was tuned, some sliver of that baked-in face
// was one bad measurement away from bleeding through. The user redrew the
// whole row with the hole left genuinely blank (a flat white fill, easy to
// cut to true alpha transparency) and, while at it, filled out the row from
// 2 items to the full 5 the original reference sheet always showed
// (おおきなインコ/ペンギン, plus previously-unimplemented シマエナガ/恐竜/
// ユニコーン) — also fixing the row's mislabeled title ("ビビ専用コスチューム"),
// which was never actually Vivi-exclusive, just a leftover label from
// whichever sample bird posed for the original sheet.
// Re-cropped all 5 from the new sheet with the same pipeline: connected-
// component detection to isolate each character cell, then a local-
// variance filter (the flat white fill has near-zero local std deviation,
// distinguishing it from the textured fur/scale art around it even on the
// near-white シマエナガ) to precisely locate the hole and cut it to real
// alpha transparency (a few px inset from the detected edge, then verified
// via connected-component analysis that the hole doesn't touch the
// exterior transparent region — same leak check as Correction #6). scale/
// offsetY are shared across all 5 (0.6973/-0.0781, same as the previous
// parrot/penguin tuning) since all 5 share the sheet's own consistent
// character proportions; facePatch is derived per-item from each one's own
// measured hole center/radius. Verified via the same from-scratch Python
// compositing simulation as Correction #6, across all 4 birds × all 4 real
// render sizes × all 5 items.
export type CosmeticRenderType = 'fullBody' | 'overlay';

// Shared by every `fullBody` item — none of them own this, it's a property
// of the WEARER's base sprite, not the costume. Crops roughly the head +
// cheek fluff (not the full 2-head-tall body) out of the shared 256x256
// assets/birds/{id}/base.png canvas, expressed as 0-1 fractions so it scales
// with any base-sprite resolution. The 4 birds' heads sit at slightly
// different heights (see this file's Correction #4 note), but this crop has
// enough margin that the difference doesn't push a face out of frame.
export const FACE_PATCH_CROP = { x0: 0.2, y0: 0.08, x1: 0.8, y1: 0.5 };

export interface CosmeticItemDef {
  id: string;
  name: string;
  category: CosmeticCategory;
  type: CosmeticRenderType;
  // Costume-only art (no bird baked in). For `overlay` items: a hood/hat/
  // cape/dress with a transparent gap wherever the wearer's own face or
  // body should show, layered on top of the wearer's full, unmodified base
  // sprite. For `fullBody` items: the entire creature costume (this IS the
  // whole visible body), with only a small face-sized hole — the wearer's
  // base sprite is not drawn at all; see facePatch below.
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
  // `fullBody` only: where to draw the small cropped face patch (see
  // FACE_PATCH_CROP) so it lands inside this costume's own face-hole.
  // Same box-fraction convention as offsetX/offsetY above; scale is the
  // (square) patch's width as a fraction of the box size. Deliberately
  // sized a little larger than the hole itself measures — the costume's
  // own opaque pixels mask away the small excess, which is safer than
  // risking a gap of empty transparency inside the hole.
  facePatch?: { scale: number; offsetX: number; offsetY: number };
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

// A sample of ~2 items per category (per the request's own "まずは各カテゴ
// リから数点ずつのサンプル実装で構いません" allowance), except 着ぐるみ
// (スペシャル) which now has its reference sheet's full 5-item row (see
// Correction #7) since the user supplied a redrawn version of that
// specific row directly.
export const COSMETIC_ITEMS: CosmeticItemDef[] = [
  {
    id: 'costume_parrot',
    name: 'おおきなインコ',
    category: 'costume',
    type: 'fullBody',
    // Re-cropped from the Correction #7 redrawn reference sheet — this
    // source's face-hole is a genuinely blank fill (no baked-in sample
    // bird), so the mask/facePatch fit here doesn't carry the previous
    // "residual face fragment" risk.
    imageAsset: require('../../assets/cosmetics/costume_parrot.png'),
    scale: 0.6973,
    aspect: 1.2305,
    offsetX: 0,
    offsetY: -0.0781,
    facePatch: { scale: 0.3108, offsetX: -0.0778, offsetY: -0.1118 },
    unlockedByDefault: true,
  },
  {
    id: 'costume_penguin',
    name: 'ペンギン',
    category: 'costume',
    type: 'fullBody',
    imageAsset: require('../../assets/cosmetics/costume_penguin.png'),
    scale: 0.6973,
    aspect: 1.2415,
    offsetX: 0,
    offsetY: -0.0781,
    facePatch: { scale: 0.3325, offsetX: -0.0421, offsetY: -0.1241 },
    unlockedByDefault: false,
  },
  {
    id: 'costume_tit',
    name: 'シマエナガ',
    category: 'costume',
    type: 'fullBody',
    imageAsset: require('../../assets/cosmetics/costume_tit.png'),
    scale: 0.6973,
    aspect: 1.271,
    offsetX: 0,
    offsetY: -0.0781,
    facePatch: { scale: 0.3133, offsetX: -0.0413, offsetY: -0.1194 },
    unlockedByDefault: false,
  },
  {
    id: 'costume_dinosaur',
    name: '恐竜(グリーン)',
    category: 'costume',
    type: 'fullBody',
    imageAsset: require('../../assets/cosmetics/costume_dinosaur.png'),
    scale: 0.6973,
    aspect: 1.0927,
    offsetX: 0,
    offsetY: -0.0781,
    facePatch: { scale: 0.2743, offsetX: -0.0947, offsetY: -0.1004 },
    unlockedByDefault: false,
  },
  {
    id: 'costume_unicorn',
    name: 'ユニコーン',
    category: 'costume',
    type: 'fullBody',
    imageAsset: require('../../assets/cosmetics/costume_unicorn.png'),
    scale: 0.6973,
    aspect: 1.186,
    offsetX: 0,
    offsetY: -0.0781,
    facePatch: { scale: 0.2877, offsetX: -0.0695, offsetY: -0.0827 },
    unlockedByDefault: false,
  },
  {
    id: 'outfit_flower_dress',
    name: 'お花のワンピース',
    category: 'outfit',
    type: 'overlay',
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
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/outfit_sailor.png'),
    scale: 0.6309,
    aspect: 1.03,
    offsetX: 0,
    offsetY: 0.2915,
    unlockedByDefault: false,
  },
  {
    id: 'cute_leaf_tunic',
    name: 'リーフチュニック',
    category: 'cute',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/cute_leaf_tunic.png'),
    scale: 0.6309,
    aspect: 0.875,
    offsetX: 0,
    offsetY: 0.2446,
    unlockedByDefault: false,
  },
  {
    id: 'cute_fluffy_sweater',
    name: 'ふわふわセーター',
    category: 'cute',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/cute_fluffy_sweater.png'),
    scale: 0.6309,
    aspect: 0.9434,
    offsetX: 0,
    offsetY: 0.2652,
    unlockedByDefault: false,
  },
  {
    id: 'event_party_dress',
    name: 'パーティードレス',
    category: 'event',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/event_party_dress.png'),
    scale: 0.6474,
    aspect: 1.0189,
    offsetX: 0,
    offsetY: 0.03,
    unlockedByDefault: false,
  },
  {
    id: 'event_santa_cape',
    name: 'サンタケープ',
    category: 'event',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/event_santa_cape.png'),
    scale: 0.6474,
    aspect: 1.2223,
    offsetX: 0,
    offsetY: 0.03,
    unlockedByDefault: false,
  },
  {
    id: 'theme_ladybug',
    name: 'てんとう虫',
    category: 'theme',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/theme_ladybug.png'),
    scale: 0.6474,
    aspect: 1.2089,
    offsetX: 0,
    offsetY: -0.18,
    unlockedByDefault: false,
  },
  {
    id: 'theme_sunflower',
    name: 'ひまわり',
    category: 'theme',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/theme_sunflower.png'),
    scale: 0.65,
    aspect: 0.5652,
    offsetX: 0,
    offsetY: -0.394,
    unlockedByDefault: false,
  },
  {
    id: 'seasonal_spring',
    name: '春(桜)',
    category: 'seasonal',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/seasonal_spring.png'),
    scale: 0.6474,
    aspect: 1.0631,
    offsetX: 0,
    offsetY: 0.03,
    unlockedByDefault: false,
  },
  {
    id: 'seasonal_winter',
    name: '冬(雪だるま)',
    category: 'seasonal',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/seasonal_winter.png'),
    scale: 0.6474,
    aspect: 1.1868,
    offsetX: 0,
    offsetY: 0.03,
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
