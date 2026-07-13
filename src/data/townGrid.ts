import { BuildingKind, ShopKind, TownPlotDef, TownPlotState } from '../types';
import { TOWN_X, TOWN_Y } from './world';
import { getBuildingOption } from './buildingOptions';

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

// The two permanent shops (SHOP_PLOT_ID/FEED_SHOP_PLOT_ID below) sit on
// ring-1's N/S axis (row ±1, col 0). The plain ring-1 offset (CELL_H, 0.1)
// left them uncomfortably close to the town zone's smallest ellipse (town
// level 1's ry is 0.108 — under 10% margin, and the shop sprite's own
// rendered footprint eats into that further), so real devices showed them
// visibly poking past the drawn boundary. Pulling them in to this smaller,
// dedicated offset keeps them safely inside at every town level — the zone
// only ever grows from level 1, never shrinks, so "safe at the smallest
// tier" is enough to guarantee "safe forever" without any level-aware
// shop-repositioning logic.
const SHOP_AXIS_OFFSET = 0.075;

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
      const isShopCell = col === 0 && Math.abs(row) === 1;
      const x = TOWN_X + axisOffset(col, CELL_W, OUTER_STEP_X);
      const y = isShopCell ? TOWN_Y + Math.sign(row) * SHOP_AXIS_OFFSET : TOWN_Y + axisOffset(row, CELL_H, OUTER_STEP_Y);

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

// Only 'general'/'feed' have a fixed plot — 'weapon'/'armor' have none at
// all until the player constructs one (see getAllShopPositions below), so
// this deliberately isn't a full Record<ShopKind, string>.
export const SHOP_PLOT_IDS: Partial<Record<ShopKind, string>> = {
  general: SHOP_PLOT_ID,
  feed: FEED_SHOP_PLOT_ID,
};

// 'general' and 'feed' always resolve (they're the two always-present
// shops) — this is only ever called for those two, so the non-null
// assertion is safe here.
export function getShopPosition(kind: ShopKind): { x: number; y: number } {
  const def = TOWN_PLOT_DEFS.find((d) => d.id === SHOP_PLOT_IDS[kind])!;
  return { x: def.x, y: def.y };
}

// Every shop the AI can currently visit, fixed or constructed: the two
// always-present shops (general/feed) plus whichever of weapon/armor/repeat
// branches the player has actually built somewhere (see
// data/buildingOptions.ts) — birds otherwise have no way to know a
// weapon/armor shop exists at all, since those don't sit on a fixed plot.
// If more than one plot builds the same shopKind, the first one found wins
// (arbitrary but stable — they all share the same stock anyway).
export function getAllShopPositions(plots: Record<string, TownPlotState>): Partial<Record<ShopKind, { x: number; y: number }>> {
  const result: Partial<Record<ShopKind, { x: number; y: number }>> = {};
  for (const kind of Object.keys(SHOP_PLOT_IDS) as ShopKind[]) {
    const plotId = SHOP_PLOT_IDS[kind];
    const def = plotId ? TOWN_PLOT_DEFS.find((d) => d.id === plotId) : undefined;
    if (def) result[kind] = { x: def.x, y: def.y };
  }
  for (const def of TOWN_PLOT_DEFS) {
    const state = plots[def.id];
    const option = getBuildingOption(state?.constructedBuildingId ?? null);
    if (option?.shopKind && !result[option.shopKind]) {
      result[option.shopKind] = { x: def.x, y: def.y };
    }
  }
  return result;
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

// Constructing a building (see data/buildingOptions.ts, useTownStore's
// constructBuilding) is a further meaningful step past just unlocking the
// land, so it earns its own (smaller) development bump.
export const CONSTRUCTION_DEVELOPMENT_POINTS = 20;

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
// footprint visibly keeps pace with the town's development.
//
// Bounded above by data/world.ts's actual field content, not just by the
// plot grid: the closest hand-placed enemy (wolf_b, at (0.75, 0.45)) sits
// only ~0.27 away from town center, so any radius past that would draw the
// town zone right on top of it — a "monster wandered into town" look, and
// (since EnemySprite renders without pointerEvents="none") a real tap-
// blocking risk for whatever it happens to overlap. The always-unlocked
// ring-1 plots (both real shops included, at 0.1/0.195 from center) still
// comfortably fit inside even the smallest tier. Ring-2's outer diagonal
// corners intentionally poke past the drawn edge at every level — the zone
// is a soft "core of town" suggestion, not a hard requirement that every
// buildable tile sit inside it.
const TOWN_ZONE_RADIUS_BY_LEVEL: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0.2, ry: 0.108 },
  2: { rx: 0.22, ry: 0.118 },
  3: { rx: 0.24, ry: 0.129 },
  4: { rx: 0.25, ry: 0.134 },
  5: { rx: 0.26, ry: 0.139 },
};

export function getTownZoneRadius(townLevel: number): { rx: number; ry: number } {
  return TOWN_ZONE_RADIUS_BY_LEVEL[townLevel] ?? TOWN_ZONE_RADIUS_BY_LEVEL[1];
}

// Whether a point falls inside the town's current core ellipse. Used to
// keep constructed buildings feeling like part of a cohesive town rather
// than scattered across the whole 48-plot grid — land can still be
// unlocked out at the level-gated outer rings (a real-device request:
// "街を街として固めたい"/keep the town looking like one town), but
// ConstructionModal only opens for a plot once the zone has actually grown
// to include it, rather than letting a shop get built somewhere the zone
// backdrop doesn't even draw yet.
export function isInsideTownZone(x: number, y: number, zoneRadius: { rx: number; ry: number }): boolean {
  const dx = (x - TOWN_X) / zoneRadius.rx;
  const dy = (y - TOWN_Y) / zoneRadius.ry;
  return dx * dx + dy * dy <= 1;
}

// Generic fallback icon per building kind — used when a plot has a
// `building` set but no matching data/buildingOptions.ts entry (either a
// kind with no construction option yet, like 'workshop'/'warehouse', or a
// save from before the construction system existed). Constructed plots
// normally show their specific BuildingOption's own emoji instead (see
// WorldMap's PlotSprite), which is more specific than this table (e.g. the
// general-goods branch and the feed branch are both kind 'shop' here, but
// render as 🛠️/🌾 respectively once matched to their option).
export const BUILDING_ICON: Record<BuildingKind, string> = {
  workshop: '🛠️',
  shop: '🏪',
  warehouse: '📦',
  garden: '🌷',
};
