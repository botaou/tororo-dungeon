import { TOWN_X, TOWN_Y } from './world';

// One small house per bird, placed just outside the buildable land grid and
// the decorative foliage ring so it never visually collides with either, and
// nudged off-axis slightly to clear nearby resource nodes too. Simple/
// temporary look for now — meant to be upgradable later as the town
// develops (per-bird identity is carried entirely by color/emoji until then).
export const HOUSE_POSITIONS: Record<string, { x: number; y: number }> = {
  tororo: { x: 0.307, y: 0.448 }, // west-ish
  vivi: { x: 0.693, y: 0.552 }, // east-ish
  haku: { x: TOWN_X, y: 0.7 }, // south
  mone: { x: TOWN_X, y: 0.3 }, // north
};

export function getHousePosition(defId: string): { x: number; y: number } {
  return HOUSE_POSITIONS[defId] ?? { x: TOWN_X, y: TOWN_Y };
}
