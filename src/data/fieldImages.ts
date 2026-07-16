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
// Real-device report: オオカミ rendered visibly cut off in the field. Its
// source crop (enemy_wolf.png) was only 53x70 — roughly half the linear
// resolution of enemy_bat.png/enemy_slime.png (~106-114px) — because the
// second reference sheet packs more columns into the same width, so its
// character art is natively smaller. Re-extracted at 2x (LANCZOS upscale
// during the crop, not a naive stretch of the old file) so it's no longer
// the noticeably lower-fidelity/smaller-margin one of the three.
export const ENEMY_IMAGES: Record<string, number> = {
  スライム: require('../../assets/field/enemy_slime.png'),
  コウモリ: require('../../assets/field/enemy_bat.png'),
  オオカミ: require('../../assets/field/enemy_wolf.png'),
};
