import { TOWN_X, TOWN_Y } from './world';

// One small house per bird, placed just outside the buildable land grid and
// the decorative foliage ring so it never visually collides with either, and
// nudged off-axis slightly to clear nearby resource nodes too. Simple/
// temporary look for now — meant to be upgradable later as the town
// develops (per-bird identity is carried entirely by color/emoji until then).
export const HOUSE_POSITIONS: Record<string, { x: number; y: number }> = {
  tororo: { x: 0.244, y: 0.455 }, // west-ish
  vivi: { x: 0.756, y: 0.545 }, // east-ish
  haku: { x: 0.435, y: 0.741 }, // south-ish
  mone: { x: 0.565, y: 0.259 }, // north-ish
};

export function getHousePosition(defId: string): { x: number; y: number } {
  return HOUSE_POSITIONS[defId] ?? { x: TOWN_X, y: TOWN_Y };
}
