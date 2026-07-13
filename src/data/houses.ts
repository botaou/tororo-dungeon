import { TOWN_X, TOWN_Y } from './world';

// One small house per bird. These used to sit well outside the town zone's
// ellipse (data/townGrid.ts's getTownZoneRadius) — real-device report showed
// all 4 houses visibly outside town limits, since they were placed with only
// the plot grid/foliage ring in mind, never checked against the zone ellipse
// added later in phase 6. Repositioned to a small diamond around the town
// hall that stays inside even the smallest (level 1) ellipse with a
// comfortable margin (~50% unused), the same "safe at the smallest tier is
// safe forever" reasoning phase 7 used for the two permanent shops — while
// still clearing the shops (on the N/S axis), the merchant spot (SE), and
// the ring-1 E/W plots (on the x-axis).
export const HOUSE_POSITIONS: Record<string, { x: number; y: number }> = {
  tororo: { x: 0.4, y: 0.446 }, // NW
  vivi: { x: 0.6, y: 0.554 }, // SE
  haku: { x: 0.4, y: 0.554 }, // SW
  mone: { x: 0.6, y: 0.446 }, // NE
};

export function getHousePosition(defId: string): { x: number; y: number } {
  return HOUSE_POSITIONS[defId] ?? { x: TOWN_X, y: TOWN_Y };
}
