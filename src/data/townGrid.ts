import { BuildingKind, ShopKind, TownPlotDef, TownPlotState } from '../types';
import { TOWN_X, TOWN_Y } from './world';
import { getBuildingOption } from './buildingOptions';

// A grid of buildable land around the town hall (the existing 🏘️ marker,
// which sits on the center cell and isn't a plot itself). A 3rd outer ring
// adds a further 24 plots at a smaller extra step (not a full further CELL
// unit — the coordinate canvas doesn't have room for that), gated behind
// minTownLevel so the buildable land visibly grows alongside the town's own
// development stage (see PHASE-6's zoning pass). The 4 orthogonal (N/S/E/W)
// ring-1 plots start unlocked; everything else costs gold + a material to
// claim, scaling with ring distance, so the town keeps visibly growing well
// past the first few plots.
//
// Real-device request: once real building art replaced the old emoji icons
// (see data/buildingImages.ts), the original spacing below (CELL_W=0.195,
// CELL_H=0.1) left buildings looking scattered across bare grass rather
// than a "properly zoned town" — a reference image showed buildings tightly
// clustered around the town hall with roads/paths visibly connecting them.
// Shrunk to ~1/3 the original spacing (chosen by the same numeric-search
// approach as the fence/plot geometry elsewhere in this file — see the
// verification notes in this session's commit) so the same 48-plot grid
// occupies a much smaller, denser footprint; nothing about the grid's own
// logic (plot count, unlock costs, ring gating) changed, only how tightly
// packed the *pixels* are.
const CELL_W = 65 / 900; // ≈0.0722 — 900 is WorldMap's WORLD_CANVAS_WIDTH
const CELL_H = 65 / 1400; // ≈0.0464 — 1400 is WorldMap's WORLD_CANVAS_HEIGHT
// How far past the ring-2 edge the ring-3 outer layer sits. Used to be a
// deliberately *smaller* step than a full CELL_W/CELL_H (so ring-3 still
// fit within the safe 0..1 canvas) — that constraint only mattered back
// when CELL_W/CELL_H were much bigger (0.195/0.1); at today's much smaller
// cell size a full further step is nowhere near the canvas edge, and a
// numeric check caught a real bug the smaller step introduced: with a
// 44px plot sprite (see WorldMap's PLOT_BUILT_SIZE) but only a 26px outer
// step, ring-2 and ring-3 plots along the same row/column visually
// overlapped (~18px). A full step restores a comfortable ~21px gap there
// instead.
const OUTER_STEP_X = CELL_W;
const OUTER_STEP_Y = CELL_H;
// Ring-3 plots can't even be attempted until the town reaches this level.
const OUTER_RING_MIN_TOWN_LEVEL = 3;

function axisOffset(v: number, cell: number, outerStep: number): number {
  if (Math.abs(v) <= 2) return v * cell;
  return Math.sign(v) * (2 * cell + outerStep);
}

// The 7 row/column indices a plot can sit on (ring -3..3) and their
// distance from the town center, as normalized (0..1 canvas) offsets — the
// same axisOffset formula buildPlotDefs uses for each plot's own x/y.
// Exported so WorldMap can draw a full grid of roads along every row/column
// line the plot grid actually uses (a real-device request for the town to
// read as road-divided city blocks rather than buildings scattered in open
// grass), without WorldMap needing to know CELL_W/CELL_H/OUTER_STEP itself.
export const PLOT_GRID_RING_INDICES = [-3, -2, -1, 0, 1, 2, 3];
export function plotGridRowOffsetY(row: number): number {
  return axisOffset(row, CELL_H, OUTER_STEP_Y);
}
export function plotGridColOffsetX(col: number): number {
  return axisOffset(col, CELL_W, OUTER_STEP_X);
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
      // The two permanent shops (SHOP_PLOT_ID/FEED_SHOP_PLOT_ID) sit on this
      // same ring-1 N/S axis — they used to need a dedicated, smaller offset
      // here to clear the (much larger, pre-density-pass) town zone ellipse
      // safely; now that both the grid and the zone were resized together
      // (see this file's own notes above and getTownZoneRadius's), the
      // plain ring-1 offset already clears it with margin, so no special
      // case is needed anymore.
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

// The north and south ring-1 plots start unlocked by default (same as the
// other two orthogonal ring-1 neighbors) but — Phase 12①("空っぽスタート") —
// no longer come pre-built with a shop already standing on them. They used
// to be forced into looking already-built regardless of the plot's real
// TownPlotState (see the removed override this comment used to describe);
// now they're just two more empty, buildable plots the player has to
// actually spend gold+material on (data/buildingOptions.ts's
// general_branch/feed_branch), same as every other plot. Kept as named
// constants purely because ai.ts's stepShopFood/executeSellTrip still walk
// birds to these exact coordinates to sell materials/eat — a bird can
// always sell raw materials and get a free ration here even before a real
// shop building exists (the town's own basic trading post, not something
// that needs constructing), so removing the auto-built shop doesn't risk
// a chicken-and-egg "no gold to ever afford the first shop" bootstrap trap.
export const SHOP_PLOT_ID = 'plot_1_0'; // south — general goods (道具屋)
export const FEED_SHOP_PLOT_ID = 'plot_-1_0'; // north — feed shop (餌屋)

// Only 'general'/'feed' have a fixed plot — 'weapon'/'armor' have none at
// all until the player constructs one (see getAllShopPositions below), so
// this deliberately isn't a full Record<ShopKind, string>.
export const SHOP_PLOT_IDS: Partial<Record<ShopKind, string>> = {
  general: SHOP_PLOT_ID,
  feed: FEED_SHOP_PLOT_ID,
};

// The fixed spot ai.ts's stepShopFood/executeSellTrip walk to for the
// always-available sell-materials/free-ration functions described above —
// deliberately independent of whether a real shop building has been
// constructed there yet (see this file's SHOP_PLOT_ID/FEED_SHOP_PLOT_ID
// comment). Only ever called for 'general'/'feed', so the non-null
// assertion is safe here.
export function getShopPosition(kind: ShopKind): { x: number; y: number } {
  const def = TOWN_PLOT_DEFS.find((d) => d.id === SHOP_PLOT_IDS[kind])!;
  return { x: def.x, y: def.y };
}

// Every shop the AI can currently *buy gear/treats from* — purely a scan of
// which plots actually have a constructed shop-kind building right now (see
// data/buildingOptions.ts), with no fixed always-present entries anymore
// (Phase 12①: general/feed used to be force-merged in here regardless of
// build state — see this file's SHOP_PLOT_ID comment for why that changed).
// A kind absent from the result means no such shop has been built anywhere
// yet, and callers (ai.ts's pickGearOffer, stepShopFood's treat-vs-free-
// ration check) already treat that as "skip this option," not an error. If
// more than one plot builds the same shopKind, the first one found wins
// (arbitrary but stable — they all share the same stock anyway).
export function getAllShopPositions(plots: Record<string, TownPlotState>): Partial<Record<ShopKind, { x: number; y: number }>> {
  const result: Partial<Record<ShopKind, { x: number; y: number }>> = {};
  for (const def of TOWN_PLOT_DEFS) {
    const state = plots[def.id];
    const option = getBuildingOption(state?.constructedBuildingId ?? null);
    if (option?.shopKind && !result[option.shopKind]) {
      result[option.shopKind] = { x: def.x, y: def.y };
    }
  }
  return result;
}

// Every constructed park/bathhouse plot (see data/buildingOptions.ts) — the
// destinations for Phase 11's "play" behavior (see ai.ts's executePlay).
// Unlike shops, these have no fixed always-present plot at all, so this is
// just the constructed-plot scan half of getAllShopPositions (no fixed-plot
// half to merge in first). A bird just heads for whichever is nearest, not
// specifically a park vs a bathhouse — there's no mechanical difference
// between the two yet, only flavor (see BuildingOption.emoji/name).
export interface AmenitySpot {
  id: string; // the plot id it's built on — doubles as BirdState.targetRefUid
  kind: 'park' | 'bathhouse';
  x: number;
  y: number;
}

export function getAllAmenityPositions(plots: Record<string, TownPlotState>): AmenitySpot[] {
  const result: AmenitySpot[] = [];
  for (const def of TOWN_PLOT_DEFS) {
    const state = plots[def.id];
    const option = getBuildingOption(state?.constructedBuildingId ?? null);
    if (option?.buildingKind === 'park' || option?.buildingKind === 'bathhouse') {
      result.push({ id: def.id, kind: option.buildingKind, x: def.x, y: def.y });
    }
  }
  return result;
}

// Every plot with something actually built on it, regardless of kind — used
// by ai.ts's randomPointNearTown (Phase 12③) to keep idle "rest" wander
// destinations off of building footprints. The town hall itself (always
// present at TOWN_X/TOWN_Y, not a plot) is added by the caller.
export function getAllBuiltPlotPositions(plots: Record<string, TownPlotState>): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  for (const def of TOWN_PLOT_DEFS) {
    if (plots[def.id]?.building) result.push({ x: def.x, y: def.y });
  }
  return result;
}

// Where the visiting merchant sets up — a fixed spot off the buildable
// grid's plots, clear of both permanent shops (which sit on the N/S axis),
// the bird houses, and the town hall. Not a real plot: nothing is ever
// built here, it's just where the temporary stall appears/vanishes.
// Repositioned alongside the density rework above (see houses.ts for the
// matching bird-house repositioning, including why this uses real
// rectangle-overlap math rather than a circle-distance approximation) — a
// randomized clearance search (with the merchant's own render box shrunk
// too, see WorldMap's merchant styles) found this spot, well west and
// slightly south of center, keeps only a small, shallow overlap (a few px,
// well inside the "acceptable exception" precedent above) against the
// now much tighter grid.
export const MERCHANT_SPOT = { x: TOWN_X - 0.1083, y: TOWN_Y + 0.0464 };

// Unlocking a plot still grows the town — it just does so by granting
// developmentPoints (see useTownStore) rather than town level being derived
// straight from plot count. Deliberately light, so the very first land
// purchase already contributes meaningfully toward the next tier.
export const PLOT_UNLOCK_DEVELOPMENT_POINTS = 30;

// Constructing a building (see data/buildingOptions.ts, useTownStore's
// constructBuilding) is a further meaningful step past just unlocking the
// land, so it earns its own (smaller) development bump.
export const CONSTRUCTION_DEVELOPMENT_POINTS = 20;

// The role field's growth path — five named stages. Phase 12②("クエスト連動
// の街発展"): these used to be crossed automatically the moment cumulative
// developmentPoints (from unlocking land, constructing buildings, and
// completing job-board requests) reached each `threshold` — which meant a
// town could level up purely as a side effect of routine job-board grinding,
// with no specific moment the player could point to as "I made the town
// grow." The town's actual current level is now an explicit, quest-driven
// field on useTownStore (bumped only by data/townQuests.ts's questline via
// useTownStore's completeTownQuest) — this table is just the name/emoji
// lookup by level number now (see getTownLevelDef). `threshold` survives
// only as descriptive flavor (shown in TownStatusModal as roughly how much
// developmentPoints this stage lines up with) — nothing gates on it anymore.
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

export function getTownLevelDef(level: number): TownLevelDef {
  return TOWN_LEVEL_DEFS.find((d) => d.level === level) ?? TOWN_LEVEL_DEFS[0];
}

// The town zone's visual backdrop + fence boundary (see WorldMap) and the
// radius AI uses to keep town-only wandering (idle "rest" strolls) and
// field-only wandering (idle "explore") on the correct side of the line.
//
// Fixed (not per-town-level) — an earlier revision grew this with each town
// level, but that meant re-verifying "does this still avoid every hand-
// placed enemy/mining node" at 5 different sizes, and that exact spot has
// already been the source of several real-device bugs this project (a
// level-locked radius overlapping field content, then blocking
// construction it could never actually grow to reach — see the
// isInsideTownZone comment below and Phase 9②'s README notes). One fixed
// size, chosen once and verified once, removes that whole recurring class
// of bug. The zone still gets to *look* like it's growing town-to-town —
// via the plot grid's road network and the buildings appearing on it — the
// ellipse itself just isn't the mechanism for that anymore.
//
// Bounded above by data/world.ts's actual field content, not just by the
// plot grid: the closest hand-placed enemy (wolf_b, at (0.75, 0.45)) sits
// only ~0.27 away from town center, so any radius past that would draw the
// town zone right on top of it — a "monster wandered into town" look, and
// (since EnemySprite renders without pointerEvents="none") a real tap-
// blocking risk for whatever it happens to overlap. Bumped slightly (from
// rx=0.22/ry=0.145) alongside the density rework above, since the much
// tighter plot grid needs a slightly bigger ellipse to still comfortably
// wrap ring-2 — at rx=0.235/ry=0.152, wolf_b (the closest field content)
// still clears with solid margin (ellipse-membership fraction ~1.24, i.e.
// ~24% outside the boundary), while every ring-1/ring-2 plot, both real
// shops, the merchant spot, and all 4 bird houses sit comfortably inside.
// Ring-3's 4 extreme corner plots intentionally sit just past the drawn
// edge — the zone is a soft "core of town" visual, not a requirement every
// buildable tile has to sit inside (construction eligibility is governed by
// plot-unlock state + minTownLevel alone, see TownScreen's handlePlotPress).
const TOWN_ZONE_RADIUS = { rx: 0.235, ry: 0.152 };

export function getTownZoneRadius(): { rx: number; ry: number } {
  return TOWN_ZONE_RADIUS;
}

// Whether a point has crossed into the town's "core" ellipse — moved here
// (was a private copy inside game/enemyAi.ts, kept only to stop a chasing
// enemy from following a fleeing bird into town) so Phase 14's free house
// placement (useTownStore's buildHouse) can reuse the exact same check as
// its "is this inside the town area" gate, rather than duplicating the
// ellipse formula a third time.
export function isInsideTownZone(x: number, y: number, zoneRadius: { rx: number; ry: number }): boolean {
  const dx = (x - TOWN_X) / zoneRadius.rx;
  const dy = (y - TOWN_Y) / zoneRadius.ry;
  return dx * dx + dy * dy <= 1;
}

// Phase 12①("空っぽスタート"): the fence ring used to be a single unbroken
// loop of all 48 posts from the very first tick, regardless of how
// undeveloped the town actually was — a brand-new save with nothing but the
// town hall still showed a fully fenced-off plot of land. The ellipse's own
// *size* stays fixed (see TOWN_ZONE_RADIUS's comment on why re-sizing that
// per level was already a recurring source of bugs); what now grows with
// townLevel is how much of that ring is actually drawn, so the fence itself
// visibly "grows in" as the town develops instead of being complete on day
// one. WorldMap draws this many of the ring's POST_COUNT positions in
// order starting from the same fixed point each time, so each level's arc
// is a strict superset of the previous one (it only ever extends further
// around the ring, never jumps to a disconnected arc elsewhere).
const FENCE_COVERAGE_BY_LEVEL: Record<number, number> = {
  1: 0.15,
  2: 0.4,
  3: 0.7,
  4: 0.9,
  5: 1,
};

export function getFenceCoverage(townLevel: number): number {
  return FENCE_COVERAGE_BY_LEVEL[townLevel] ?? 1;
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
  park: '🌳',
  bathhouse: '🛁',
};
