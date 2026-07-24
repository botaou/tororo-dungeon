import { ShopKind, TownBuildingInstance } from '../types';
import { TOWN_X, TOWN_Y } from './world';
import { getBuildingOption } from './buildingOptions';

// Map-split step 2 removed the town-zone ellipse; this "Step B" pass removes
// the other half of the old grid system — the fixed 48-cell buildable-land
// grid (TOWN_PLOT_DEFS et al: per-ring unlock costs, minTownLevel gating,
// road-grid geometry) is gone entirely. Buildings are now freely placed
// anywhere in town (see types.ts's TownBuildingInstance, useTownStore's
// constructBuilding) — how many can exist at once is capped by town level
// (TOWN_BUILDING_CAP_BY_LEVEL below) instead of by how much numbered land
// has been unlocked, and each one's cost scales with how many are already
// built (see data/buildingOptions.ts's getScaledBuildingCost) instead of by
// ring distance. See git history for the old grid formula if it's ever
// needed again (useTownStore's migrate() also keeps a copy, just enough to
// recover a pre-existing save's exact building positions).

// Every building the player has actually constructed, keyed by shop kind —
// a kind absent here means no such shop exists anywhere yet (see ai.ts's
// pickGearOffer/stepShopFood, which already treat that as "skip this
// option," not an error). If more than one building of the same shopKind
// exists, the first one found wins (arbitrary but stable — they all share
// the same stock anyway).
export function getAllShopPositions(buildings: Record<string, TownBuildingInstance>): Partial<Record<ShopKind, { x: number; y: number }>> {
  const result: Partial<Record<ShopKind, { x: number; y: number }>> = {};
  for (const b of Object.values(buildings)) {
    const option = getBuildingOption(b.constructedBuildingId);
    if (option?.shopKind && !result[option.shopKind]) {
      result[option.shopKind] = { x: b.x, y: b.y };
    }
  }
  return result;
}

// Every constructed park/bathhouse — the destinations for Phase 11's "play"
// behavior (see ai.ts's executePlay). A bird just heads for whichever is
// nearest, not specifically a park vs a bathhouse.
export interface AmenitySpot {
  id: string; // the building instance's own id — doubles as BirdState.targetRefUid
  kind: 'park' | 'bathhouse';
  x: number;
  y: number;
}

export function getAllAmenityPositions(buildings: Record<string, TownBuildingInstance>): AmenitySpot[] {
  const result: AmenitySpot[] = [];
  for (const b of Object.values(buildings)) {
    const option = getBuildingOption(b.constructedBuildingId);
    if (option?.buildingKind === 'park' || option?.buildingKind === 'bathhouse') {
      result.push({ id: b.id, kind: option.buildingKind, x: b.x, y: b.y });
    }
  }
  return result;
}

// Every constructed building's own position — used by ai.ts's
// randomPointNearTown to keep idle "rest" wander destinations off of
// building footprints, and by useTownStore's isBuildingSpotBlocked/
// isHouseSpotBlocked for mutual clearance checking. The town hall itself
// (always present at TOWN_X/TOWN_Y, not a building instance) is added by
// each caller separately.
export function getAllBuildingPositions(buildings: Record<string, TownBuildingInstance>): { x: number; y: number }[] {
  return Object.values(buildings).map((b) => ({ x: b.x, y: b.y }));
}

// The always-available "basic trading post" spot — where a hungry/broke
// bird walks for the free ration / plain material sale that never requires
// a real shop to exist yet (see ai.ts's stepShopFood/executeSellTrip). Once
// a real feed/general shop is actually constructed somewhere, the bird
// walks to that real building instead (world.shopPositions.feed/general) —
// this is only the fallback for before that happens. Sits right next to the
// shopkeeper NPC's own spot (see components/WorldMap.tsx's ShopkeeperSprite)
// since that NPC is the one flavor-wise "running" this basic trade.
export const BASIC_TRADE_SPOT = { x: TOWN_X, y: TOWN_Y + 0.03 };

// Where the visiting merchant sets up — a fixed spot, well clear of the
// town hall and the shopkeeper/basic-trade spot. Not a real building:
// nothing is ever built here, it's just where the temporary stall
// appears/vanishes.
export const MERCHANT_SPOT = { x: TOWN_X - 0.1083, y: TOWN_Y + 0.0464 };

// How many buildings (see TownBuildingInstance) can exist in town at once,
// by town level — replaces the old "how much land has been unlocked"
// concept. The final tier (48) deliberately matches the old grid's own
// absolute max plot count, so a fully-developed town is never worse off
// than before; the climb from 5→48 mirrors TOWN_LEVEL_DEFS's own five
// stages (see getTownBuildingCap).
export const TOWN_BUILDING_CAP_BY_LEVEL: Record<number, number> = {
  1: 5,
  2: 10,
  3: 18,
  4: 30,
  5: 48,
};

export function getTownBuildingCap(townLevel: number): number {
  return TOWN_BUILDING_CAP_BY_LEVEL[townLevel] ?? TOWN_BUILDING_CAP_BY_LEVEL[1];
}

// Unlocking a plot used to grow the town by granting developmentPoints —
// there's no more "unlock" step (see this file's own top comment), so only
// the construction bump survives.
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
