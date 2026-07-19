// Phase-13 feasibility prototype (see IsometricPrototypeScreen.tsx) — pure,
// dependency-free math only. Deliberately kept separate from anything in
// src/game or src/components so this can be deleted or promoted to a real
// module later without having touched production code at all.
//
// Standard 2:1 isometric grid→screen projection (the same one Kairosoft-
// style games use): a tile that's `tileWidth` wide and `tileHeight` tall on
// screen (tileHeight is normally half of tileWidth, giving the classic
// shallow-diamond look) maps grid (gridX, gridY) to a screen offset via:
//   screenX = (gridX - gridY) * (tileWidth / 2)
//   screenY = (gridX + gridY) * (tileHeight / 2)
// gridX increases "southeast" on screen, gridY increases "southwest" — the
// two grid axes each move diagonally on screen, which is what actually
// produces the diamond tiling (as opposed to a plain top-down grid, where
// each axis moves in a single screen direction).
export interface IsoTileSize {
  width: number;
  height: number;
}

export function gridToScreen(gridX: number, gridY: number, tile: IsoTileSize): { x: number; y: number } {
  return {
    x: (gridX - gridY) * (tile.width / 2),
    y: (gridX + gridY) * (tile.height / 2),
  };
}

// The inverse — screen offset (relative to the same origin gridToScreen
// uses) back to fractional grid coordinates. Needed for "where did the user
// tap" style hit-testing once this goes past a prototype; not used by the
// prototype screen itself yet (movement there is just two hardcoded grid
// points), but worth having proven correct now while the formula is fresh,
// since getting this wrong is a common isometric bug (an easy sign/half
// error breaks tap targeting even when gridToScreen alone looks fine).
export function screenToGrid(screenX: number, screenY: number, tile: IsoTileSize): { x: number; y: number } {
  const halfW = tile.width / 2;
  const halfH = tile.height / 2;
  return {
    x: screenX / (2 * halfW) + screenY / (2 * halfH),
    y: screenY / (2 * halfH) - screenX / (2 * halfW),
  };
}

// Painter's-algorithm depth key — draw lower-depth things first (further
// "back"), higher-depth things last (further "front", i.e. closer to the
// camera / lower on screen). For a plain grid tile, depth is just
// gridX + gridY (a tile's own screenY is proportional to this already, see
// gridToScreen). For a *moving* entity at a continuous, non-integer
// position, the exact same formula still works — sort key doesn't need to
// be an integer, entities just need to compare consistently against both
// tiles and each other. A building that's visually taller than one tile
// (pokes "up" on screen past its own footprint) would need its footprint's
// *base* (the ground tile it stands on), not its sprite's on-screen top, to
// be what's sorted — buildingImages.ts's assets are already bottom-anchored
// for exactly this reason (see that file's own comment), so their footprint
// depth and their sprite's anchor point are the same thing here.
export function depthKey(gridX: number, gridY: number): number {
  return gridX + gridY;
}
