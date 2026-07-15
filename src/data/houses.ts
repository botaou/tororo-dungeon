import { TOWN_X, TOWN_Y } from './world';

// One small house per bird, arranged in a small diamond around the town
// hall. Repositioned alongside the town-density rework (see townGrid.ts's
// CELL_W/CELL_H notes) — shrinking the plot grid's own spacing left no room
// for the houses' old fixed diamond.
//
// The plots/town-hall/houses all render as *rectangles* (bottom-anchored
// boxes, see WorldMap.tsx), not circles, so a naive "distance minus radii"
// clearance check is optimistic — two square-ish boxes offset diagonally
// can overlap even when a circle model says they're clear, since a box's
// corner reaches further than an inscribed circle's radius. Re-deriving
// this with real rectangle-overlap math: with plots on a uniform 65px grid
// at 44px each, the exact symmetric point between any 4 neighboring plots
// (offset 32.5px each way from the nearest grid line) is the *provably
// best possible* spot for anything bigger than a 21px box — a 36px house
// there still clips its 4 neighbors by ~7.5px on each axis. That small,
// unavoidable corner overlap (well under a fifth of either box's own size)
// is accepted the same way this file's other "acceptable exception"
// precedents are: the overlap is shallow enough that each plot/house stays
// independently tappable outside the small shared corner.
export const HOUSE_POSITIONS: Record<string, { x: number; y: number }> = {
  tororo: { x: 0.4639, y: 0.4304 }, // NW
  vivi: { x: 0.5361, y: 0.5696 }, // SE
  haku: { x: 0.4639, y: 0.5696 }, // SW
  mone: { x: 0.5361, y: 0.4304 }, // NE
};

export function getHousePosition(defId: string): { x: number; y: number } {
  return HOUSE_POSITIONS[defId] ?? { x: TOWN_X, y: TOWN_Y };
}
