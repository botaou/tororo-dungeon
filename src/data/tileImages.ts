// Ground-tile art cropped from a hand-painted reference sheet (20 tiles, 4
// rows x 5 cols — see assets/tiles/ for the full set, all saved as
// individual files even though only a handful are wired up here). Two
// shapes of each tile were produced:
// - the plain PNG: the tile's own scalloped/leafy silhouette with a
//   transparent background, for a single accent image that doesn't need
//   to repeat (a locked plot, a mining node's accent).
// - the "_tile" PNG: a tight center-crop with the scalloped edge trimmed
//   away, fully opaque — meant to be used with Image's resizeMode="repeat"
//   to fill an arbitrarily large area without the scalloped edges creating
//   visible seams between copies.
//
// React Native needs static require() calls to bundle images, so this
// module exists purely to give the handful actually used in WorldMap.tsx a
// name instead of a raw path.
export const TILE_IMAGES = {
  // Locked-plot background (both the affordable-locked and level-gated
  // "untamed" states) — plain, calm grass, single image per plot.
  grassPlain: require('../../assets/tiles/grass_plain_1.png'),
  // A small accent behind a mining node, suggesting a little dig site.
  dirtPatchRound: require('../../assets/tiles/dirt_patch_round.png'),
} as const;

// Seamless repeat-fill textures for the field's loose zone patches (see
// WorldMap's FIELD_ZONE_PATCHES) and the town zone's own subtle backdrop.
export const TILE_REPEAT_IMAGES = {
  forest: require('../../assets/tiles/grass_dark_flowers_tile.png'),
  quarry: require('../../assets/tiles/grass_rocks_tile.png'),
  mushroom: require('../../assets/tiles/clover_dense_tile.png'),
  lake: require('../../assets/tiles/grass_blue_flowers_tile.png'),
  ruins: require('../../assets/tiles/dirt_full_tile.png'),
  town: require('../../assets/tiles/grass_plain_1_tile.png'),
} as const;
