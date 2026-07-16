import { MaterialId } from '../types';

// Field-object (gatherable node) and enemy art cropped from a hand-painted
// reference sheet (see assets/field/) — replaces the emoji placeholders
// WorldMap.tsx used for mining nodes and enemies. Same background-removal +
// bounding-box-trim pipeline as assets/buildings/ and assets/cosmetics/.
//
// Only 8 of the 14 MaterialId resources have a directly-matching field-
// object illustration in the reference sheet (wood/ore/gem/herb/berry/
// mushroom/fish/relic) — coal and magicStone reuse the closest visual
// cousin already cropped (a plain small rock, and the same blue crystal
// cluster as gem) rather than force a mismatched image or spend another
// cropping pass on a single extra rock/crystal variant. feather/pearl/
// waterweed/oldCoin have no matching art at all in the sheet, so they keep
// an emoji fallback (data/materials.ts's MATERIAL_ICON — see below) instead
// of forcing a mismatched image.
export const FIELD_OBJECT_IMAGES: Partial<Record<MaterialId, number>> = {
  wood: require('../../assets/field/tree.png'),
  ore: require('../../assets/field/rock_big.png'),
  coal: require('../../assets/field/rock_small.png'),
  gem: require('../../assets/field/crystal_ore.png'),
  magicStone: require('../../assets/field/crystal_ore.png'),
  herb: require('../../assets/field/herb.png'),
  berry: require('../../assets/field/berry_bush.png'),
  mushroom: require('../../assets/field/mushroom.png'),
  fish: require('../../assets/field/fishing_pond.png'),
  relic: require('../../assets/field/relic.png'),
};

// Shown in place of FIELD_OBJECT_IMAGES while a node is on its post-harvest
// respawn cooldown (see WorldMap's RockSprite) — previously the node just
// faded out and rendered nothing until it respawned. Reusing the same
// coal/magicStone-share-with-ore/gem convention as above.
export const FIELD_OBJECT_AFTER_IMAGES: Partial<Record<MaterialId, number>> = {
  wood: require('../../assets/field/tree_stump.png'),
  ore: require('../../assets/field/rock_big_after.png'),
  coal: require('../../assets/field/rock_small_after.png'),
  gem: require('../../assets/field/crystal_ore_after.png'),
  magicStone: require('../../assets/field/crystal_ore_after.png'),
  herb: require('../../assets/field/herb_after.png'),
  berry: require('../../assets/field/berry_bush_after.png'),
  mushroom: require('../../assets/field/mushroom_after.png'),
  fish: require('../../assets/field/fishing_pond_after.png'),
  relic: require('../../assets/field/relic_after.png'),
};

// The 4 materials with no matching art (feather/pearl/waterweed/oldCoin)
// fall back to data/materials.ts's MATERIAL_ICON (already a complete,
// already-used-elsewhere per-material emoji map) instead of a new one
// defined here — that fixes the same "shared 🍄" bug by construction,
// since MATERIAL_ICON never had it to begin with.

// Keyed by EnemyDef.name (see data/world.ts's ENEMY_DEFS) — every def
// sharing a name shares the same look, same as the emoji it replaces. Per
// the request's own "厳密な1対1対応である必要はありません" allowance, these
// are picked for closest vibe rather than an exact species match: スライム
// and コウモリ come from the reference sheet's 森/鉱山エリア, オオカミ from a
// second reference sheet's 森エリア (the first sheet has no wolf-like
// enemy at all).
//
// Real-device report: オオカミ rendered visibly cut off in the field —
// initially treated as a resolution problem (the first crop was only
// 53x70, half the linear resolution of enemy_bat.png/enemy_slime.png at
// ~106-114px) and "fixed" by re-extracting at 2x. That didn't actually
// address it: a second real-device report showed the exact same hard,
// flat-edged clip through the middle of the wolf's face — impossible for
// resizeMode="contain" to produce (it only ever scales the whole image
// down to fit, never crops), which pointed back at the source PNG itself.
// Re-examining that first crop against the original reference sheet showed
// it wasn't actually a resolution issue at all — the crop region had
// bled into part of a *second*, larger wolf illustration positioned
// immediately behind/beside ウルフル in the sheet, baking a ghost
// second-body into the right side of the image. Re-cropped from the
// original reference sheet using this file's usual column-boundary method
// (detecting each label's text connected-components and splitting at the
// midpoint between neighboring labels, since eyeballing cell edges is what
// caused this same class of bug for other field assets too — see the
// building/tile note in this file's history) — the new crop is a single
// clean wolf with no ghosting, still upscaled 2x to match bat/slime's
// resolution.
export const ENEMY_IMAGES: Record<string, number> = {
  スライム: require('../../assets/field/enemy_slime.png'),
  コウモリ: require('../../assets/field/enemy_bat.png'),
  オオカミ: require('../../assets/field/enemy_wolf.png'),
};
