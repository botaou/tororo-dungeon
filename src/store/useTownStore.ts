import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CONSTRUCTION_DEVELOPMENT_POINTS, getAllBuildingPositions, getTownBuildingCap } from '../data/townGrid';
import { BUILDING_OPTIONS, getScaledBuildingCost } from '../data/buildingOptions';
import { HOUSE_POSITIONS } from '../data/houses';
import { HOUSE_BUILD_COST, HOUSE_CLEARANCE, TOWN_BUILDING_CLEARANCE } from '../game/config';
import { isKnownCharacterId } from '../data/characters';
import { HouseState, TownBuildingInstance } from '../types';
import { usePlayerStore } from './usePlayerStore';
import { TOWN_X, TOWN_Y } from '../data/world';

// Queued for TownLevelUpModal — same one-time-notification pattern as
// useWorldStore's recruitmentEvents, just carrying enough of the triggering
// TownQuestDef (see data/townQuests.ts) to show "what just unlocked" rather
// than only the bare new level number (Phase 12②).
export interface TownLevelUpEvent {
  level: number;
  questName: string;
  rewardText: string;
}

interface TownState {
  // Step B ("building free placement"): every constructed shop/amenity,
  // freely positioned rather than tied to one of the old grid's 48 fixed
  // plot ids — see types.ts's TownBuildingInstance for why, and this
  // store's own migrate() for how a pre-existing save's buildings land at
  // the exact same (x,y) they always had.
  buildings: Record<string, TownBuildingInstance>;
  // Flavor/reputation-adjacent currency — grows from constructing buildings
  // and completing job-board requests (see useWorldStore), shown in
  // TownStatusModal. Phase 12②: no longer gates townLevel (see that field's
  // own comment) — nothing else reads this either, it's purely a "how much
  // has this town accomplished" readout.
  developmentPoints: number;
  // The town's popularity/renown — tracked independently from
  // developmentPoints on purpose (see job rewards in data/jobPresets.ts).
  // Nothing reads this yet; it's just accumulated for future systems
  // (museum donations, merchant visit frequency, etc.).
  reputation: number;
  // The town's actual current tier (see data/townGrid.ts's TOWN_LEVEL_DEFS
  // for the name/emoji at each level) — Phase 12②: used to auto-advance the
  // instant developmentPoints crossed a threshold; now the *only* way this
  // ever changes is completeTownQuest, driven by data/townQuests.ts's
  // questline. Starts at 1 (ボロ役場), same starting tier as before.
  townLevel: number;
  // How many TOWN_QUESTS entries have been completed so far — also the
  // index of the currently-active quest (TOWN_QUESTS[townQuestIndex]), or
  // "questline finished" once it reaches TOWN_QUESTS.length.
  townQuestIndex: number;
  // How many job-board requests (of any kind) have ever been completed —
  // powers the 'five_requests' town quest condition (see data/
  // townQuests.ts) — incremented alongside every addDevelopmentPoints call
  // a completed request already triggers (see useWorldStore).
  completedRequestCount: number;
  // Ever-growing log of town-quest completions this game — the UI queues
  // off this to show a "quest cleared!" announcement (with the level it
  // granted) for each one exactly once, same pattern as
  // useWorldStore's recruitmentEvents.
  levelUpEvents: TownLevelUpEvent[];
  // Phase 14: houses, independent of any particular bird — see HouseState's
  // own comment (types.ts) for why. Starts empty (`{}`) for a brand-new
  // save, matching Phase 12①'s empty-start philosophy (nothing pre-built;
  // the player builds every house themselves); a pre-existing save instead
  // gets its 4 already-lived-in houses seeded once by this store's own
  // persist migrate (version 1→2), so nothing about an existing player's
  // town changes the moment this ships.
  houses: Record<string, HouseState>;
}

interface TownActions {
  // Step B: spends a BuildingOption's cost (scaled by how many buildings
  // already stand in town — see data/buildingOptions.ts's
  // getScaledBuildingCost) to place it at an arbitrary (x, y). Returns false
  // (no charge taken) if the town is already at its building cap for the
  // current town level (getTownBuildingCap), the spot is too close to
  // something else already standing there (isBuildingSpotBlocked), or the
  // cost isn't fully covered.
  constructBuilding: (optionId: string, x: number, y: number) => boolean;
  // Relocates an already-built building to a new (x, y) — same clearance
  // rule as constructBuilding (isBuildingSpotBlocked), except the building's
  // own current spot is excluded from that check (so it never collides with
  // itself), and there's no cost/cap check since nothing new is being
  // built. Returns false (no state change) if the building doesn't exist or
  // the new spot is blocked by something else.
  moveBuilding: (buildingId: string, x: number, y: number) => boolean;
  addDevelopmentPoints: (amount: number) => void;
  addReputation: (amount: number) => void;
  // Called once per completed job-board request (see useWorldStore) — feeds
  // the 'five_requests' town quest condition.
  recordRequestCompleted: () => void;
  // Marks a TOWN_QUESTS entry complete, bumps townLevel to its
  // grantsTownLevel (never backwards — a no-op if somehow already past it),
  // advances townQuestIndex to the next quest, and queues a levelUpEvent. A
  // no-op if this exact quest id was already the one just completed (the
  // per-tick condition check in useWorldStore could otherwise fire twice in
  // the same tick before townQuestIndex updates elsewhere reads it).
  completeTownQuest: (questId: string, questName: string, rewardText: string, grantsTownLevel: number) => void;
  // Phase 14's free (non-grid) placement, scoped to houses (see game/
  // config.ts's HOUSE_BUILD_COST/HOUSE_CLEARANCE and this file's own
  // isHouseSpotBlocked) — spends the cost and creates a new, vacant
  // (residentDefId: null) house at (x, y). Returns false (no charge taken)
  // if the spot is too close to anything else already standing there, or
  // the player can't afford it.
  buildHouse: (x: number, y: number) => boolean;
  // Moves a recruited-but-unhoused bird into a vacant house. False (no
  // state change) if the house doesn't exist or already has a resident, or
  // if this bird already lives somewhere else (a bird only ever has one
  // house at a time — reassigning would need to vacate the old one first,
  // a feature this doesn't cover yet).
  assignHouseResident: (houseId: string, defId: string) => boolean;
}

let houseIdCounter = 0;
let buildingIdCounter = 0;

// Simple radius-clearance check (see game/config.ts's HOUSE_CLEARANCE) — not
// real rectangle overlap math, same "good enough, and this project has been
// bitten by fancier geometry before" precedent as ai.ts's
// randomPointNearTown/BUILDING_CLEARANCE.
function isHouseSpotBlocked(x: number, y: number, houses: Record<string, HouseState>, buildingPositions: { x: number; y: number }[]): boolean {
  if (Math.hypot(x - TOWN_X, y - TOWN_Y) < HOUSE_CLEARANCE) return true;
  for (const h of Object.values(houses)) {
    if (Math.hypot(x - h.x, y - h.y) < HOUSE_CLEARANCE) return true;
  }
  for (const p of buildingPositions) {
    if (Math.hypot(x - p.x, y - p.y) < HOUSE_CLEARANCE) return true;
  }
  return false;
}

// Step B's own version of the clearance check above — a new building must
// keep clear of the town hall, every house, and every other building
// already standing (mutual with isHouseSpotBlocked: a house checks against
// buildingPositions too, so neither category can be placed on top of the
// other). `excludeBuildingId` skips one building's own entry from the
// check — used when relocating a building (see moveBuilding), so its old
// spot never counts as "something else in the way" of its own new spot.
function isBuildingSpotBlocked(
  x: number,
  y: number,
  buildings: Record<string, TownBuildingInstance>,
  houses: Record<string, HouseState>,
  excludeBuildingId?: string
): boolean {
  if (Math.hypot(x - TOWN_X, y - TOWN_Y) < TOWN_BUILDING_CLEARANCE) return true;
  for (const b of Object.values(buildings)) {
    if (b.id === excludeBuildingId) continue;
    if (Math.hypot(x - b.x, y - b.y) < TOWN_BUILDING_CLEARANCE) return true;
  }
  for (const h of Object.values(houses)) {
    if (Math.hypot(x - h.x, y - h.y) < TOWN_BUILDING_CLEARANCE) return true;
  }
  return false;
}

// Placement-preview UX: a pure, read-only check (no state mutation, no
// cost/cap check — those are only meaningful at actual construction time,
// see constructBuilding) so the UI can color a moveable preview sprite
// green/red as the player taps around before committing. Reads live store
// state directly rather than taking it as a parameter, since this is called
// straight from render code (see TownScreen's previewPosition) rather than
// from inside a set()/get() callback. `excludeBuildingId` — see
// isBuildingSpotBlocked's own comment — is passed while relocating an
// existing building (see TownScreen's movingBuildingId) so the preview
// doesn't read as "blocked" just from sitting near/on the building's own
// current (soon to be vacated) spot.
export function isBuildingPlacementBlocked(x: number, y: number, excludeBuildingId?: string): boolean {
  const s = useTownStore.getState();
  return isBuildingSpotBlocked(x, y, s.buildings, s.houses, excludeBuildingId);
}

// Superseded by Step B's free placement — kept only so migrate() below can
// recover each old fixed-grid plot's exact (x, y) and preserve a
// pre-existing save's building positions/look. The old grid's own
// axisOffset formula had a "smaller outer-ring step" branch that, at the
// constants actually shipped (OUTER_STEP == CELL), always collapsed to
// plain `index * cell` for every ring — see git history for the full
// original townGrid.ts if the real formula is ever needed again. Do not use
// this for anything new.
function legacyPlotPosition(plotId: string): { x: number; y: number } {
  const [, rowStr, colStr] = plotId.split('_');
  const CELL_W = 65 / 900;
  const CELL_H = 65 / 1400;
  return { x: TOWN_X + Number(colStr) * CELL_W, y: TOWN_Y + Number(rowStr) * CELL_H };
}

export const useTownStore = create<TownState & TownActions>()(
  persist(
    (set, get) => ({
      buildings: {},
      developmentPoints: 0,
      reputation: 0,
      townLevel: 1,
      townQuestIndex: 0,
      completedRequestCount: 0,
      levelUpEvents: [],
      houses: {},

      constructBuilding: (optionId, x, y) => {
        const option = BUILDING_OPTIONS.find((o) => o.id === optionId);
        if (!option) return false;

        const s = get();
        const builtCount = Object.keys(s.buildings).length;
        if (builtCount >= getTownBuildingCap(s.townLevel)) return false;
        if (isBuildingSpotBlocked(x, y, s.buildings, s.houses)) return false;

        const cost = getScaledBuildingCost(option, builtCount);
        const player = usePlayerStore.getState();
        if (player.gold < cost.gold) return false;
        const owned = player.materials[cost.materialId] ?? 0;
        if (owned < cost.materialAmount) return false;

        player.trySpendGold(cost.gold);
        player.addMaterials({ [cost.materialId]: -cost.materialAmount });

        buildingIdCounter += 1;
        const id = `building_${buildingIdCounter}_${Date.now()}`;
        set({
          buildings: { ...s.buildings, [id]: { id, x, y, constructedBuildingId: option.id } },
          developmentPoints: s.developmentPoints + CONSTRUCTION_DEVELOPMENT_POINTS,
        });
        return true;
      },

      moveBuilding: (buildingId, x, y) => {
        const s = get();
        const building = s.buildings[buildingId];
        if (!building) return false;
        if (isBuildingSpotBlocked(x, y, s.buildings, s.houses, buildingId)) return false;

        set({ buildings: { ...s.buildings, [buildingId]: { ...building, x, y } } });
        return true;
      },

      addDevelopmentPoints: (amount) => set((s) => ({ developmentPoints: s.developmentPoints + amount })),

      addReputation: (amount) => set((s) => ({ reputation: s.reputation + amount })),

      recordRequestCompleted: () => set((s) => ({ completedRequestCount: s.completedRequestCount + 1 })),

      completeTownQuest: (questId, questName, rewardText, grantsTownLevel) => {
        const s = get();
        // townQuestIndex always advances (moving on to check the next
        // quest) even when grantsTownLevel doesn't actually raise townLevel
        // — the only way that happens is a migrated save (see this store's
        // `migrate` below) already grandfathered in past this quest's own
        // level, and without advancing here the questline would get
        // permanently stuck re-checking (and no-op'ing on) the same
        // already-satisfied quest forever.
        const shouldGrantLevel = grantsTownLevel > s.townLevel;
        set({
          townLevel: shouldGrantLevel ? grantsTownLevel : s.townLevel,
          townQuestIndex: s.townQuestIndex + 1,
          levelUpEvents: shouldGrantLevel
            ? [...s.levelUpEvents, { level: grantsTownLevel, questName, rewardText }]
            : s.levelUpEvents,
        });
      },

      buildHouse: (x, y) => {
        // Map-split step 2 removed the old "is this inside the town zone"
        // gate — TownMap is its own dedicated screen now. Overlap/clearance
        // checking (below) is the only placement guard left, same as the
        // mayor's room's own furniture placement never needed a zone check
        // either.
        const s = get();
        if (isHouseSpotBlocked(x, y, s.houses, getAllBuildingPositions(s.buildings))) return false;

        const player = usePlayerStore.getState();
        if (player.gold < HOUSE_BUILD_COST.gold) return false;
        const owned = player.materials[HOUSE_BUILD_COST.materialId] ?? 0;
        if (owned < HOUSE_BUILD_COST.materialAmount) return false;

        player.trySpendGold(HOUSE_BUILD_COST.gold);
        player.addMaterials({ [HOUSE_BUILD_COST.materialId]: -HOUSE_BUILD_COST.materialAmount });

        houseIdCounter += 1;
        const id = `house_${houseIdCounter}_${Date.now()}`;
        set({ houses: { ...s.houses, [id]: { id, x, y, residentDefId: null } } });
        return true;
      },

      assignHouseResident: (houseId, defId) => {
        const s = get();
        const house = s.houses[houseId];
        if (!house || house.residentDefId !== null) return false;
        // A bird only ever has one house at a time — this project has no
        // "move out"/reassign feature yet, so silently stealing a bird from
        // its current house here would strand that other house's own
        // residentDefId pointing at a bird that's actually moved, which
        // nothing else expects. Simplest safe rule: refuse until that's
        // explicitly supported.
        const alreadyHoused = Object.values(s.houses).some((h) => h.residentDefId === defId);
        if (alreadyHoused) return false;

        set({ houses: { ...s.houses, [houseId]: { ...house, residentDefId: defId } } });
        return true;
      },
    }),
    {
      name: 'tororo-dungeon-town-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 4,
      // Phase 12②: pre-existing saves have developmentPoints but no
      // explicit townLevel field (see TownState.townLevel's own comment on
      // why level used to be derived from points instead of stored).
      // Grandfather an already-developed town's level in from the old
      // points-threshold ladder here (thresholds inlined since the real
      // getTownLevel/TOWN_LEVEL_DEFS.threshold-based function was removed)
      // so it doesn't visually regress to a bare town hall — fence
      // shrinking back down, roads disappearing — the moment this update
      // ships. townQuestIndex stays at 0; completeTownQuest's own
      // shouldGrantLevel guard fast-forwards it past any quest whose
      // grantsTownLevel this grandfathered level already covers, over the
      // next few ticks, without re-granting or re-notifying anything.
      migrate: (persisted: unknown, version) => {
        let state = persisted as Partial<TownState> & {
          plots?: Record<string, { id: string; unlocked: boolean; building: string | null; constructedBuildingId: string | null }>;
        };
        if (version < 1) {
          const points = state?.developmentPoints ?? 0;
          const thresholds = [0, 60, 180, 400, 800];
          let level = 1;
          for (let i = 0; i < thresholds.length; i++) if (points >= thresholds[i]) level = i + 1;
          state = {
            ...state,
            townLevel: level,
            townQuestIndex: 0,
            completedRequestCount: 0,
            levelUpEvents: [],
          };
        }
        if (version < 2) {
          // Phase 14: houses used to be a fixed Record<defId, {x,y}> (see
          // data/houses.ts) with identity/position/art all baked into the
          // bird's own defId — a pre-existing save has 4 already-lived-in
          // houses that must not suddenly go vacant (that would instantly
          // start the houseless-sulk clock in useWorldStore's tick() for
          // birds that did nothing wrong). Seed exactly those 4 here, with
          // their resident already assigned, so a returning player's town
          // looks identical the moment this ships. A brand-new save instead
          // starts from this store's own initial `houses: {}` above (this
          // migrate function never runs for a save that never existed
          // before) — matching Phase 12①'s empty-start philosophy, a new
          // player builds every house themselves from scratch.
          state = {
            ...state,
            houses: Object.fromEntries(
              Object.entries(HOUSE_POSITIONS).map(([defId, pos]) => [
                `house_${defId}`,
                { id: `house_${defId}`, x: pos.x, y: pos.y, residentDefId: defId },
              ])
            ),
          };
        }
        if (version < 3) {
          // Step B ("building free placement"): the old fixed 48-slot grid
          // (TOWN_PLOT_DEFS) is gone — every already-built plot becomes a
          // free-placed TownBuildingInstance at that exact same (x, y) (see
          // legacyPlotPosition above) so a returning player's town looks
          // pixel-identical the moment this ships. Plots that were merely
          // *unlocked* but never built have nothing to migrate — there's no
          // more "claimed but empty land" concept, so they just disappear,
          // which is strictly a superset of what they were (any spot, not
          // just former plot slots, is now buildable).
          const legacyPlots = state?.plots ?? {};
          const buildings: Record<string, TownBuildingInstance> = {};
          for (const [plotId, plotState] of Object.entries(legacyPlots)) {
            if (!plotState.building || !plotState.constructedBuildingId) continue;
            buildingIdCounter += 1;
            const id = `building_migrated_${buildingIdCounter}`;
            buildings[id] = { id, ...legacyPlotPosition(plotId), constructedBuildingId: plotState.constructedBuildingId };
          }
          state = { ...state, buildings };
          delete state.plots;
        }
        if (version < 4) {
          // A save from before アルシェル was pulled out of CHARACTERS (see
          // characters.ts's isKnownCharacterId) could have had her assigned
          // to a house via HouseAssignModal while she was still recruitable
          // — WorldMap.tsx's house rendering calls getCharacterDef(house.
          // residentDefId) unconditionally, which would throw and crash the
          // app the moment TownScreen tried to render that house. Vacate
          // (not delete) any house whose resident no longer exists, so the
          // building itself stays standing and simply becomes assignable
          // to another bird again — same "heal, don't discard the player's
          // structure" precedent as this store's other migrate steps.
          const houses = state?.houses ?? {};
          state = {
            ...state,
            houses: Object.fromEntries(
              Object.entries(houses).map(([id, house]) => [
                id,
                house.residentDefId && !isKnownCharacterId(house.residentDefId)
                  ? { ...house, residentDefId: null }
                  : house,
              ])
            ),
          };
        }
        return state as unknown as TownState & TownActions;
      },
    }
  )
);
