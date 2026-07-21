// Building/facility art cropped from a hand-painted reference sheet (see
// assets/buildings/ for the full set) — replaces the emoji placeholders
// WorldMap.tsx used for the town hall, shops, the merchant's tent, park/
// bathhouse, bird houses, and the town-zone fence. Each source cell was
// background-removed (the sheet used a plain near-white/checkered card
// background per cell, not real alpha) and trimmed to its own tight
// bounding box, so every image's own bottom edge is already its "ground
// line" — WorldMap positions these bottom-anchored (see BUILDING_IMAGE_SIZE
// usage) rather than centered, so buildings of very different heights (a
// squat ボロ役場 vs. the towered トロロ自然保護本部) all still stand on the
// same spot instead of floating at different heights.
//
// React Native needs static require() calls to bundle images, so this
// module exists purely to give each asset a name instead of a raw path.

export const TOWNHALL_IMAGES: Record<number, number> = {
  1: require('../../assets/buildings/townhall_1.png'),
  2: require('../../assets/buildings/townhall_2.png'),
  3: require('../../assets/buildings/townhall_3.png'),
  4: require('../../assets/buildings/townhall_4.png'),
  5: require('../../assets/buildings/townhall_5.png'),
};

// Keyed by ShopKind (see types.ts) — 'general' is the hat/shield branch
// (餌屋 and 道具屋 are visually distinct buildings in the reference sheet
// despite both being data/shops.ts SHOP_DEFS entries). Partial rather than a
// full Record<ShopKind, number> — Phase 15③'s 5 new shop kinds have no
// matching reference art (sample-level scope, no new reference sheet
// commissioned), so they fall back to WorldMap's plain emoji-chip plot look
// (see PlotSprite's shopImage ?? amenityImage fallback) same as 'garden'
// already does among the decorative BuildingOptions.
export const SHOP_IMAGES: Partial<Record<import('../types').ShopKind, number>> = {
  general: require('../../assets/buildings/shop_general.png'),
  feed: require('../../assets/buildings/shop_feed.png'),
  weapon: require('../../assets/buildings/shop_weapon.png'),
  armor: require('../../assets/buildings/shop_armor.png'),
};

export const MERCHANT_TENT_IMAGE = require('../../assets/buildings/merchant_tent.png');

// Keyed by data/buildingOptions.ts's BuildingOption.id for the two Phase 11
// amenities — 'garden' has no matching art in this sheet, so it keeps its
// 🌷 emoji.
export const AMENITY_IMAGES: Record<string, number> = {
  park: require('../../assets/buildings/amenity_park.png'),
  bathhouse: require('../../assets/buildings/amenity_bathhouse.png'),
};

// Keyed by CharacterDef.id — colors match each bird's own accent color
// (see data/characters.ts) directly, so no separate color-to-house lookup
// is needed.
export const HOUSE_IMAGES: Record<string, number> = {
  vivi: require('../../assets/buildings/house_vivi.png'),
  haku: require('../../assets/buildings/house_haku.png'),
  tororo: require('../../assets/buildings/house_tororo.png'),
  mone: require('../../assets/buildings/house_mone.png'),
};

// Phase 14: a freshly-built, not-yet-assigned house (see HouseState.
// residentDefId === null) — a plain desaturated recolor of one of the
// bird-colored houses above (simple approach, per the request's own "簡易対応
// で可"), so an empty house visibly reads as "nobody lives here yet" next to
// the colorful occupied ones instead of looking broken/missing.
export const HOUSE_VACANT_IMAGE = require('../../assets/buildings/house_vacant.png');

// A single fence-panel image repeated around the town zone's boundary ring
// (see WorldMap's fenceNodes), each instance rotated to sit tangent to the
// ellipse at its own point — simpler than switching between the sheet's
// straight/corner/gate variants, which would need real per-segment layout
// logic to line up cleanly around a curve. The reference sheet included 8
// fence variants total (short/long straight, corner, gate in wood; straight/
// corner in stone; straight/corner hedge) — only this one is wired up for
// now, per the request's own "1〜2種類の簡易な実装でも構わない" allowance;
// the rest are cropped and saved in assets/buildings/ for future use.
export const FENCE_IMAGE = require('../../assets/buildings/fence_wood_short.png');

// Cropped but not currently wired to any on-map element — the shared
// warehouse and job-board sprites in the reference sheet have no matching
// building slot in the game yet (the town's material stash and request
// board are both plain UI panels today, not map buildings). Kept here so
// wiring them up later (e.g. if a warehouse/job-board building option is
// ever added) doesn't need another cropping pass.
export const WAREHOUSE_IMAGE = require('../../assets/buildings/warehouse.png');
export const JOB_BOARD_IMAGE = require('../../assets/buildings/job_board.png');
