import { BuildingKind, ShopKind, TownPlotDef } from '../types';
import { TOWN_X, TOWN_Y } from './world';

// A grid of buildable land around the town hall (the existing 🏘️ marker,
// which sits on the center cell and isn't a plot itself). The inner two
// rings (rows/cols -2..2) keep their original spacing exactly — nothing
// hand-placed around them (houses, decor, the merchant spot) needs to move.
// A 3rd outer ring adds a further 24 plots at a smaller extra step (not a
// full further CELL unit — the coordinate canvas doesn't have room for
// that), gated behind minTownLevel so the buildable land visibly grows
// alongside the town's own development stage (see PHASE-6's zoning pass).
// The 4 orthogonal (N/S/E/W) ring-1 plots start unlocked; everything else
// costs gold + a material to claim, scaling with ring distance, so the town
// keeps visibly growing well past the first few plots.
const CELL_W = 0.195;
const CELL_H = 0.1;
// How far past the ring-2 edge the ring-3 outer layer sits — deliberately
// less than a full CELL_W/CELL_H step so it still fits within the safe
// 0..1 canvas instead of running off-screen.
const OUTER_STEP_X = 0.075;
const OUTER_STEP_Y = 0.04;
// Ring-3 plots can't even be attempted until the town reaches this level.
const OUTER_RING_MIN_TOWN_LEVEL = 3;

function axisOffset(v: number, cell: number, outerStep: number): number {
  if (Math.abs(v) <= 2) return v * cell;
  return Math.sign(v) * (2 * cell + outerStep);
}

function buildPlotDefs(): TownPlotDef[] {
  const defs: TownPlotDef[] = [];
  const materialCycle: Array<'wood' | 'ore' | 'mushroom' | 'berry'> = ['wood', 'ore', 'mushroom', 'berry'];
  let materialIndex = 0;

  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      if (row === 0 && col === 0) continue; // town hall cell, not a plot

      const ringDist = Math.max(Math.abs(row), Math.abs(col));
      const unlockedByDefault = ringDist <= 1 && (row === 0 || col === 0); // orthogonal ring-1 neighbors
      const x = TOWN_X + axisOffset(col, CELL_W, OUTER_STEP_X);
      const y = TOWN_Y + axisOffset(row, CELL_H, OUTER_STEP_Y);

      let unlockCost: TownPlotDef['unlockCost'] = null;
      if (!unlockedByDefault) {
        const materialId = materialCycle[materialIndex % materialCycle.length];
        materialIndex += 1;
        unlockCost = { gold: 150 * ringDist, materialId, materialAmount: 8 * ringDist };
      }

      defs.push({
        id: `plot_${row}_${col}`,
        x,
        y,
        unlockedByDefault,
        unlockCost,
        minTownLevel: ringDist >= 3 ? OUTER_RING_MIN_TOWN_LEVEL : undefined,
      });
    }
  }
  return defs;
}

export const TOWN_PLOT_DEFS: TownPlotDef[] = buildPlotDefs();

// The north and south ring-1 plots are real, always-present shops rather
// than empty player-buildable lots — the town always has at least a
// couple of working (well, tappable) buildings in it from the start, per
// the request that the town shouldn't be 100% player-built.
export const SHOP_PLOT_ID = 'plot_1_0'; // south — general goods (道具屋)
export const FEED_SHOP_PLOT_ID = 'plot_-1_0'; // north — feed shop (餌屋)

export const SHOP_PLOT_IDS: Record<ShopKind, string> = {
  general: SHOP_PLOT_ID,
  feed: FEED_SHOP_PLOT_ID,
};

export function getShopPosition(kind: ShopKind): { x: number; y: number } {
  const def = TOWN_PLOT_DEFS.find((d) => d.id === SHOP_PLOT_IDS[kind])!;
  return { x: def.x, y: def.y };
}

// Where the visiting merchant sets up — a fixed spot off the buildable
// grid's diagonal plots, southeast of the town hall, clear of both
// permanent shops (which sit on the N/S axis). Not a real plot: nothing
// is ever built here, it's just where the temporary stall appears/vanishes.
export const MERCHANT_SPOT = { x: TOWN_X + 0.11, y: TOWN_Y + 0.11 };

export function shopKindForPlot(plotId: string): ShopKind | null {
  return (Object.keys(SHOP_PLOT_IDS) as ShopKind[]).find((k) => SHOP_PLOT_IDS[k] === plotId) ?? null;
}

// Unlocking a plot still grows the town — it just does so by granting
// developmentPoints (see useTownStore) rather than town level being derived
// straight from plot count. Deliberately light, so the very first land
// purchase already contributes meaningfully toward the next tier.
export const PLOT_UNLOCK_DEVELOPMENT_POINTS = 30;

// The role field's growth path — five named stages, each unlocked once
// cumulative developmentPoints (from unlocking land and from completing
// job-board requests, see useTownStore) reaches its threshold. Thresholds
// are deliberately light/round; balance is expected to change later.
export interface TownLevelDef {
  level: number;
  name: string;
  emoji: string;
  threshold: number;
}

export const TOWN_LEVEL_DEFS: TownLevelDef[] = [
  { level: 1, name: 'ボロ役場', emoji: '🛖', threshold: 0 },
  { level: 2, name: '村役場', emoji: '🏘️', threshold: 60 },
  { level: 3, name: '町役場', emoji: '🏛️', threshold: 180 },
  { level: 4, name: '自然保護局', emoji: '🌲', threshold: 400 },
  { level: 5, name: 'トロロ自然保護本部', emoji: '🏯', threshold: 800 },
];

export function getTownLevel(developmentPoints: number): number {
  let level = 1;
  for (const def of TOWN_LEVEL_DEFS) {
    if (developmentPoints >= def.threshold) level = def.level;
  }
  return level;
}

export function getTownLevelDef(level: number): TownLevelDef {
  return TOWN_LEVEL_DEFS.find((d) => d.level === level) ?? TOWN_LEVEL_DEFS[0];
}

// The town zone's visual backdrop (an ellipse centered on the town hall,
// see WorldMap) and the radius AI uses to keep town-only wandering
// (idle "rest" strolls) and field-only wandering (idle "explore") on the
// correct side of the line — grows with each town-level tier so the zone's
// footprint visibly keeps pace with however much land is actually
// reachable at that level (level 1 already comfortably fits ring-2, which
// has no level gate; level 3+ additionally fits the gated ring-3 outer
// layer). Purely cosmetic/behavioral past that — nothing stops it from
// slightly exceeding the field canvas at the highest tiers, since WorldMap
// clips its own bounds anyway.
const TOWN_ZONE_RADIUS_BY_LEVEL: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0.43, ry: 0.23 },
  2: { rx: 0.46, ry: 0.245 },
  3: { rx: 0.5, ry: 0.26 },
  4: { rx: 0.53, ry: 0.27 },
  5: { rx: 0.56, ry: 0.28 },
};

export function getTownZoneRadius(townLevel: number): { rx: number; ry: number } {
  return TOWN_ZONE_RADIUS_BY_LEVEL[townLevel] ?? TOWN_ZONE_RADIUS_BY_LEVEL[1];
}

export const BUILDING_ICON: Record<BuildingKind, string> = {
  workshop: '🛠️',
  shop: '🏪',
  warehouse: '📦',
};

// Cycle order when tapping an empty/occupied unlocked plot.
export const BUILDING_CYCLE: (BuildingKind | null)[] = [null, 'workshop', 'shop', 'warehouse'];
