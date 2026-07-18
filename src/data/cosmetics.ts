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
//
// Correction #8 (real-device report: "かおがつぶれてる" — the face patch
// looked squished/warped instead of a clean round face like the reference
// sheet's example renders): this rectangle used to be 0.6 wide × 0.42 tall
// (x0:0.2/x1:0.8/y0:0.08/y1:0.5) — not square. CharacterAvatar.tsx renders
// the face patch by resizeMode:'stretch'-ing the wearer's whole (square,
// 256×256) base sprite so that this crop's box maps onto the patch's own
// square container; a non-square crop of a square source stretched into a
// square container is exactly a non-uniform stretch, which is what
// "つぶれてる" was — the wider-than-tall crop got squeezed vertically to
// fill a square, warping the face. Fixed by making the crop square
// (0.48×0.48) so a uniform-aspect source maps onto a uniform-aspect
// container with no distortion, re-centered slightly lower (y0 raised from
// 0.08 to stay, y1 pulled up from 0.5 to 0.56 is actually *larger* — the
// old rectangle was shorter than it was wide) to comfortably frame each
// bird's whole head (verified per-bird against each base.png's own
// row-width profile: heads plateau around 110-118px wide before the
// shoulders begin widening again past roughly y=127, so this crop's lower
// edge stops just short of that to avoid pulling in shoulder/wing pixels).
//
// Correction #11 (real-device report on the fullBody costumes specifically
// — screenshot showed a band of the wearer's own CROWN color, not face
// color, arcing across the top of the circular face patch; e.g. Tororo's
// green crown feathers showed as a green crescent above the orange face
// inside the unicorn/parrot/etc. hole). Correction #8's square crop
// (y0:0.08) was tuned to frame the wearer's *whole head*, including a
// strip of crown/forehead plumage above the actual face-color region —
// fine for a plain square preview, but once clipped to a CIRCLE (as the
// face patch always is), the circle's own top arc sits almost entirely
// within that crown strip, since a circle inscribed in a square touches
// the square's top edge only at the very top-center and curves away from
// it fast — the top ~15-20% of the circle's height ends up showing
// whatever color is at the crop's top edge, not the face. Measured where
// each bird's crown color actually gives way to face color (Tororo is the
// worst case: green until y≈0.22-0.24 of the 256px canvas, vs. Vivi/Mone's
// less jarring yellow→orange transition around y≈0.2, and Haku with no
// contrast at all since its crown and face are both white) and shrank the
// crop to a smaller square sitting entirely below that line (0.32×0.32,
// y0:0.20-y1:0.52, centered on the same ~0.36 eye-line used elsewhere in
// this file) — small enough that even Tororo's crop is pure face color
// end to end. facePatch.scale/offsetX/offsetY (below, per item) didn't
// need to change: those position the circular *container* on the avatar
// box to match each costume's hole, which is independent of what image
// content fills that container. Re-verified across all 4 birds × all 4
// real render sizes × all 5 fullBody items that no crown-color arc
// remains.
//
// Correction #12 (explicit design request: "着ぐるみ、もう少し横長、縦ももう少し
// 顔出す部分大きく" — make the fullBody face opening a bit wider and a bit
// taller): unlike earlier corrections, this needed two coordinated changes,
// since the visible "hole" a player sees is actually two independent things
// that must stay in sync — the real transparent cutout baked into each
// costume_*.png, and the facePatch container CharacterAvatar.tsx draws
// inside it. Enlarging only the facePatch would just get masked by the
// costume's own opaque fabric around the old, still-small hole; enlarging
// only the PNG hole would leave the small old face patch floating in a
// bigger empty gap (the same look Correction #9 fixed once already). Both
// were widened together: each costume_*.png's hole (previously close to
// circular, rx≈ry) was re-cut ~35% wider and ~15% taller from its existing
// center (still comfortably inside the illustrated head/hood silhouette,
// re-verified per item), and FACE_PATCH_CROP switched from a square to a
// rectangle (0.42 wide × ~0.337 tall) to match — `facePatch` itself also
// changed shape: `scale` (a single square side) became separate `width`/
// `height` fractions so CharacterAvatar.tsx can render a non-square,
// stadium-clipped container (`borderRadius: min(width,height)/2`) instead
// of a forced circle. y0 was deliberately left at Correction #11's 0.20 —
// growing the crop by extending y1 downward and x0/x1 outward, not by
// raising y0 — to avoid re-exposing the crown-color band that fix removed.
export const FACE_PATCH_CROP = { x0: 0.29, y0: 0.2, x1: 0.71, y1: 0.537 };

// Correction #9 (real-device report: face patch no longer distorted after
// Correction #8, but noticeably smaller than the reference sheet's example
// renders, leaving a wide ring of empty hole around a tiny face): each
// fullBody item's facePatch.scale used to target roughly 1.08x the
// costume's own measured hole diameter (a small safety margin, the excess
// meant to be hidden behind the costume's opaque ring). That's technically
// correct but reads as "small face floating in a big hole" rather than the
// reference sheet's look, where the face fills the hole edge-to-edge with
// no visible margin. Bumped the multiplier to ~1.5x (all 5 items' scale
// values below reflect this) — re-verified via the same compositing
// simulation used for Correction #7/#8 that the larger patch still stays
// within each costume's own head/hood silhouette (doesn't poke out past
// the illustrated edge) across all 4 birds × all 4 real render sizes.
//
// Same report also asked to swap in a redrawn version of 3 `overlay`
// garments (outfit_sailor/cute_leaf_tunic/cute_fluffy_sweater — the exact 3
// item 34 had found genuinely didn't leave a face gap at all) — the user
// supplied a new reference sheet for these where, like Correction #7's
// kigurumi row, the collar/neckline "peekaboo" gap is painted as a flat
// solid fill rather than real alpha transparency, so it needed the same
// treatment: crop each garment out (background removed via edge-detected
// "walls" + flood-filling from the image border, since these sit on a
// blurred color-gradient backdrop rather than a flat one), then locate and
// cut the solid-color collar-interior patch to real transparency (found via
// a color-similarity flood fill seeded inside that patch — distinct enough
// per-item, e.g. tan-khaki for the hoodie vs off-white body, dark green
// collar-inside vs lighter green body for the poncho, grey-blue vs white
// for the sailor collar — that a single global rule wasn't needed). Unlike
// the fullBody items, `overlay` garments draw the wearer's ordinary base
// sprite underneath (untouched, at the box's full size) and simply place
// the garment art on top, so offsetX/offsetY here were derived directly
// from where each garment's own cut hole sits (as a box-fraction) so it
// lands over the wearer's actual eye-line (measured across all 4 birds'
// base sprites, landing on a shared target of 0.36 box-fraction — slightly
// biased toward Haku/Tororo's lower eye-line, same "biggest head in the
// roster" compromise this file's Correction #4 note already established
// for other head-hugging items) rather than reusing the old (pre-redraw)
// art's offsetY values, since the new art's own collar-hole position isn't
// the same as the old broken art's.
//
// Correction #10 (real-device report, screenshot showing the eyes half-
// hidden under the hood/collar edge on all 3 Correction #9 garments): the
// 0.36 eye-line target above was itself the bug. These collar gaps are
// short — only ~7% of the rendered box height once scaled down (a "V"
// notch, not a tall opening) — so centering the gap exactly on the eye's
// own vertical center clips the top half of the eye against the gap's own
// top edge; there just isn't enough headroom inside the gap once the eye's
// own height is accounted for. Re-tuned by rendering the actual shipped
// (not the pre-downsize full-resolution) assets at several offsetY values
// and choosing by eye instead of by formula: outfit_sailor 0.14,
// cute_leaf_tunic / cute_fluffy_sweater 0.12 — each pushes the garment
// down enough that the gap's opening clears the eyes with visible margin,
// verified across all 4 birds × 48/44/40/32px. Correction #9's own
// simulation had actually been rendering the same "eyes clipped at the
// gap's top edge" result all along — its render grid just wasn't
// scrutinized closely enough to catch it (a small render at thumbnail
// scale reads as "a face is visible in there" without making the clipping
// obvious). This pass re-checked by zooming into individual renders
// rather than only eyeballing the full grid.

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
  // Same box-fraction convention as offsetX/offsetY above; width/height are
  // the patch's own size as box-size fractions (independent per axis since
  // Correction #12 — the hole isn't perfectly circular, so a single square
  // `scale` isn't enough to match its shape without distorting or leaving a
  // gap). Deliberately sized a little larger than the hole itself measures
  // — the costume's own opaque pixels mask away the small excess, which is
  // safer than risking a gap of empty transparency inside the hole.
  facePatch?: { width: number; height: number; offsetX: number; offsetY: number };
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
    facePatch: { width: 0.5954, height: 0.4662, offsetX: -0.0814, offsetY: -0.1168 },
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
    facePatch: { width: 0.6291, height: 0.5112, offsetX: -0.0465, offsetY: -0.1285 },
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
    facePatch: { width: 0.5954, height: 0.4775, offsetX: -0.0465, offsetY: -0.1246 },
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
    facePatch: { width: 0.5224, height: 0.4325, offsetX: -0.0988, offsetY: -0.1052 },
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
    facePatch: { width: 0.5392, height: 0.4381, offsetX: -0.0736, offsetY: -0.0878 },
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
    // Re-cropped from the Correction #9 redrawn reference sheet (see this
    // file's Correction #9 note below the FACE_PATCH_CROP export) — the
    // collar's inner "peekaboo" gap is now cut to real alpha transparency
    // rather than the old art's neckline sitting too high to leave any gap
    // at all.
    imageAsset: require('../../assets/cosmetics/outfit_sailor.png'),
    scale: 0.6309,
    aspect: 0.8333,
    offsetX: 0.0164,
    offsetY: 0.14,
    unlockedByDefault: false,
  },
  {
    id: 'cute_leaf_tunic',
    name: 'リーフチュニック',
    category: 'cute',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/cute_leaf_tunic.png'),
    scale: 0.6309,
    aspect: 0.8333,
    offsetX: 0.0127,
    offsetY: 0.12,
    unlockedByDefault: false,
  },
  {
    id: 'cute_fluffy_sweater',
    name: 'ふわふわセーター',
    category: 'cute',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/cute_fluffy_sweater.png'),
    scale: 0.6309,
    aspect: 0.8056,
    offsetX: 0.0162,
    offsetY: 0.12,
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
  // Correction #13 (user-supplied new reference sheet, 6 items, request:
  // "新しく作ってみたので差し替えてみて"): unlike prior "swap this specific
  // broken item" rounds, this sheet didn't name which existing items to
  // replace, and doesn't cleanly 1:1-match anything already in the catalog
  // by design (different, more graphic-flat art style) — added as 6 new
  // items rather than guessed replacements. This source was on a real
  // (but baked-into-RGB, not alpha) checkerboard "transparency" backdrop —
  // a different background-removal problem than either prior sheet: a
  // gradient-blur backdrop (item 40) responds to edge-detected "walls" +
  // border flood fill, but a checkerboard's own hard square edges get
  // mistaken for walls everywhere, breaking the true background into
  // thousands of isolated one-tile islands that never connect to the
  // border and so never get flagged as background. Solved by classifying
  // pixels directly by color instead (near-grayscale AND close to either
  // of the checker's two known gray levels, with a wide enough tolerance
  // band to also swallow the anti-aliased seams between tiles — a narrow
  // tolerance left a fine grid of stray "foreground" seam pixels bridging
  // every tile together into one giant blob), then keeping only the
  // largest surviving connected region per item.
  // outfit_navy_sailor/cute_pink_hoodie/cute_sunflower_shirt/
  // theme_starry_cape/seasonal_plaid_cape needed a face-hole cut in
  // (unlike item 40's sheet, none of these had one pre-marked in any way —
  // no flat-fill collar-interior patch to color-match, so each hole's
  // position/size was chosen by hand against that item's own collar
  // geometry, sized generously and offset downward from the start —
  // applying item 41's lesson up front (a hole centered exactly on the
  // eye-line clips the eyes; push the whole garment down so the gap's
  // opening clears them) instead of discovering it the hard way again).
  // cute_leaf_cape is the one exception: its reference art is a fully open
  // shoulder-mantle (two wing-like flaps joined by a clasp, no chest panel
  // at all) — already-transparent below the clasp with nothing to cut —
  // so it's positioned high on the shoulders with the wearer's whole body
  // showing underneath, the same idea as event_santa_cape. All 6 verified
  // via the same compositing simulation across all 4 birds × 48/44/40/32px
  // before shipping; as first-pass additions (not fixes to something
  // previously confirmed working), their offsets are more likely than the
  // rest of this catalog to need a follow-up nudge from real-device
  // feedback.
  //
  // Correction #14 (real-device report: "上すぎる！！あと着ぐるみはいい感じ、
  // あとほんとに一回りだけ穴をデカくして"): exactly the predicted Correction #13
  // follow-up nudge, landing on the 5 new face-holed overlay garments —
  // the formula-derived offsetY values above (chosen by measuring where
  // each hand-cut hole sits, same method that worked for the fullBody
  // items) put the hole's opening too high, clipping straight across the
  // eyes (worst on seasonal_plaid_cape, the one screenshotted). Rather
  // than re-derive the formula, each was re-tuned the Correction #10 way —
  // rendering the actual shipped asset at 120px across a spread of
  // candidate offsetY and picking by eye, re-checked across all 4 birds:
  // outfit_navy_sailor 0.10, cute_pink_hoodie 0.16, cute_sunflower_shirt
  // 0.10, theme_starry_cape 0.16, seasonal_plaid_cape 0.18 (the largest
  // push, matching how badly it clipped in the report). Separately, the
  // report's "着ぐるみはいい感じ" confirmed Correction #12's fullBody hole
  // enlargement landed correctly, but asked for one more modest size bump
  // ("一回りだけ" — just one notch) — each of the 5 costume_*.png's already-
  // enlarged holes was grown a further ~16% from its own center (rx/ry ×
  // 1.16; FACE_PATCH_CROP itself stays fixed, only each item's own
  // facePatch width/height/offsetX/offsetY below were recomputed to match
  // the new hole size/position), re-verified via the same border-touch
  // leak check as Correction #12 that none escape past their costume's own
  // head/hood silhouette — costume_parrot's hole was the tightest fit and
  // needed a smaller multiplier than the rest at first try, so all 5 were
  // leveled to the same safe 1.16x for consistency.
  {
    id: 'outfit_navy_sailor',
    name: 'セーラー襟(ネイビー)',
    category: 'outfit',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/outfit_navy_sailor.png'),
    scale: 0.6309,
    aspect: 0.5611,
    offsetX: 0,
    offsetY: 0.1,
    unlockedByDefault: false,
  },
  {
    id: 'cute_pink_hoodie',
    name: 'ピンクパーカー',
    category: 'cute',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/cute_pink_hoodie.png'),
    scale: 0.6309,
    aspect: 0.7,
    offsetX: 0,
    offsetY: 0.16,
    unlockedByDefault: false,
  },
  {
    id: 'cute_leaf_cape',
    name: '葉っぱのケープ',
    category: 'cute',
    type: 'overlay',
    // No face-hole — this cape's own art is naturally open below the
    // clasp (see Correction #13), so the wearer's full base sprite just
    // shows through underneath, same idea as event_santa_cape.
    imageAsset: require('../../assets/cosmetics/cute_leaf_cape.png'),
    scale: 0.6474,
    aspect: 0.5722,
    offsetX: 0,
    offsetY: 0.03,
    unlockedByDefault: false,
  },
  {
    id: 'theme_starry_cape',
    name: '星空のケープ',
    category: 'theme',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/theme_starry_cape.png'),
    scale: 0.6309,
    aspect: 0.6944,
    offsetX: 0,
    offsetY: 0.16,
    unlockedByDefault: false,
  },
  {
    id: 'cute_sunflower_shirt',
    name: 'ひまわりシャツ',
    category: 'cute',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/cute_sunflower_shirt.png'),
    scale: 0.6309,
    aspect: 0.65,
    offsetX: 0,
    offsetY: 0.1,
    unlockedByDefault: false,
  },
  {
    id: 'seasonal_plaid_cape',
    name: 'チェックのケープ',
    category: 'seasonal',
    type: 'overlay',
    imageAsset: require('../../assets/cosmetics/seasonal_plaid_cape.png'),
    scale: 0.6309,
    aspect: 0.6167,
    offsetX: 0,
    offsetY: 0.18,
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
