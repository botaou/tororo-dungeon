import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CONSTRUCTION_DEVELOPMENT_POINTS, PLOT_UNLOCK_DEVELOPMENT_POINTS, TOWN_PLOT_DEFS } from '../data/townGrid';
import { BUILDING_OPTIONS } from '../data/buildingOptions';
import { PlotUnlockCost, TownPlotState } from '../types';
import { usePlayerStore } from './usePlayerStore';

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
  plots: Record<string, TownPlotState>;
  // Flavor/reputation-adjacent currency — grows from unlocking land,
  // constructing buildings, and completing job-board requests (see
  // useWorldStore), shown in TownStatusModal. Phase 12②: no longer gates
  // townLevel (see that field's own comment) — nothing else reads this
  // either, it's purely a "how much has this town accomplished" readout.
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
}

interface TownActions {
  // Unlocking spends gold/material up front — the caller passes the def's
  // cost (and, for the level-gated outer ring, its minTownLevel) so this
  // store doesn't need to import world data just to look it up.
  tryUnlockPlot: (plotId: string, cost: PlotUnlockCost, minTownLevel?: number) => boolean;
  // Spends a BuildingOption's cost (gold + one material) to place it on an
  // unlocked, still-empty plot. False (no charge taken) if the plot isn't
  // eligible or the cost isn't fully covered.
  constructBuilding: (plotId: string, optionId: string) => boolean;
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
}

function ensurePlot(plots: Record<string, TownPlotState>, plotId: string, unlockedByDefault: boolean): TownPlotState {
  return plots[plotId] ?? { id: plotId, unlocked: unlockedByDefault, building: null, constructedBuildingId: null };
}

export const useTownStore = create<TownState & TownActions>()(
  persist(
    (set, get) => ({
      plots: {},
      developmentPoints: 0,
      reputation: 0,
      townLevel: 1,
      townQuestIndex: 0,
      completedRequestCount: 0,
      levelUpEvents: [],

      tryUnlockPlot: (plotId, cost, minTownLevel) => {
        if (minTownLevel && get().townLevel < minTownLevel) return false;
        const player = usePlayerStore.getState();
        if (player.gold < cost.gold) return false;
        if (cost.materialId && cost.materialAmount) {
          const owned = player.materials[cost.materialId as keyof typeof player.materials] ?? 0;
          if (owned < cost.materialAmount) return false;
        }

        player.trySpendGold(cost.gold);
        if (cost.materialId && cost.materialAmount) {
          player.addMaterials({ [cost.materialId]: -cost.materialAmount });
        }

        const plots = { ...get().plots };
        const existing = ensurePlot(plots, plotId, false);
        plots[plotId] = { ...existing, unlocked: true };
        set({ plots, developmentPoints: get().developmentPoints + PLOT_UNLOCK_DEVELOPMENT_POINTS });
        return true;
      },

      constructBuilding: (plotId, optionId) => {
        const option = BUILDING_OPTIONS.find((o) => o.id === optionId);
        if (!option) return false;
        // The 4 orthogonal ring-1 plots start unlocked by default and may
        // never have been written to `plots` (only tryUnlockPlot/
        // constructBuilding itself ever create an entry) — falling back to
        // `get().plots[plotId]` alone made building on one of those a
        // silent no-op, since `existing` was undefined and this bailed out
        // before ever charging or setting anything (real-device report).
        const def = TOWN_PLOT_DEFS.find((d) => d.id === plotId);
        if (!def) return false;
        const existing = ensurePlot(get().plots, plotId, def.unlockedByDefault);
        if (!existing.unlocked || existing.building) return false;

        const player = usePlayerStore.getState();
        if (player.gold < option.cost.gold) return false;
        const owned = player.materials[option.cost.materialId] ?? 0;
        if (owned < option.cost.materialAmount) return false;

        player.trySpendGold(option.cost.gold);
        player.addMaterials({ [option.cost.materialId]: -option.cost.materialAmount });

        const plots = { ...get().plots };
        plots[plotId] = { ...existing, building: option.buildingKind, constructedBuildingId: option.id };
        set({ plots, developmentPoints: get().developmentPoints + CONSTRUCTION_DEVELOPMENT_POINTS });
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
    }),
    {
      name: 'tororo-dungeon-town-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
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
        if (version >= 1) return persisted as TownState & TownActions;
        const state = persisted as Partial<TownState>;
        const points = state?.developmentPoints ?? 0;
        const thresholds = [0, 60, 180, 400, 800];
        let level = 1;
        for (let i = 0; i < thresholds.length; i++) if (points >= thresholds[i]) level = i + 1;
        return {
          ...state,
          townLevel: level,
          townQuestIndex: 0,
          completedRequestCount: 0,
          levelUpEvents: [],
        } as unknown as TownState & TownActions;
      },
    }
  )
);

export function getPlotState(plots: Record<string, TownPlotState>, plotId: string, unlockedByDefault: boolean): TownPlotState {
  return plots[plotId] ?? { id: plotId, unlocked: unlockedByDefault, building: null, constructedBuildingId: null };
}
