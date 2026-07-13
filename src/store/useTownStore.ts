import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CONSTRUCTION_DEVELOPMENT_POINTS, getTownLevel, PLOT_UNLOCK_DEVELOPMENT_POINTS, TOWN_PLOT_DEFS } from '../data/townGrid';
import { BUILDING_OPTIONS } from '../data/buildingOptions';
import { PlotUnlockCost, TownPlotState } from '../types';
import { usePlayerStore } from './usePlayerStore';

interface TownState {
  plots: Record<string, TownPlotState>;
  // Drives townLevel (see data/townGrid.ts's getTownLevel/TOWN_LEVEL_DEFS) —
  // grows from unlocking land and from completing job-board requests
  // (useWorldStore). Deliberately a separate currency from reputation below.
  developmentPoints: number;
  // The town's popularity/renown — tracked independently from
  // developmentPoints on purpose (see job rewards in data/jobPresets.ts).
  // Nothing reads this yet; it's just accumulated for future systems
  // (museum donations, merchant visit frequency, etc.).
  reputation: number;
  // Ever-growing log of new town levels reached this game — the UI queues
  // off this to show a "leveled up!" announcement for each one exactly
  // once, the same pattern useWorldStore's recruitmentEvents uses.
  levelUpEvents: number[];
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
}

function ensurePlot(plots: Record<string, TownPlotState>, plotId: string, unlockedByDefault: boolean): TownPlotState {
  return plots[plotId] ?? { id: plotId, unlocked: unlockedByDefault, building: null, constructedBuildingId: null };
}

// Shared by tryUnlockPlot and addDevelopmentPoints: applies the point gain
// and returns whichever new level(s) it just crossed (almost always zero or
// one, but a big enough gain could cross more than one tier at once).
function applyPoints(currentPoints: number, amount: number): { nextPoints: number; crossedLevels: number[] } {
  const prevLevel = getTownLevel(currentPoints);
  const nextPoints = currentPoints + amount;
  const nextLevel = getTownLevel(nextPoints);
  const crossedLevels: number[] = [];
  for (let lv = prevLevel + 1; lv <= nextLevel; lv++) crossedLevels.push(lv);
  return { nextPoints, crossedLevels };
}

export const useTownStore = create<TownState & TownActions>()(
  persist(
    (set, get) => ({
      plots: {},
      developmentPoints: 0,
      reputation: 0,
      levelUpEvents: [],

      tryUnlockPlot: (plotId, cost, minTownLevel) => {
        if (minTownLevel && getTownLevel(get().developmentPoints) < minTownLevel) return false;
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
        const { nextPoints, crossedLevels } = applyPoints(get().developmentPoints, PLOT_UNLOCK_DEVELOPMENT_POINTS);
        set({
          plots,
          developmentPoints: nextPoints,
          levelUpEvents: crossedLevels.length > 0 ? [...get().levelUpEvents, ...crossedLevels] : get().levelUpEvents,
        });
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
        const { nextPoints, crossedLevels } = applyPoints(get().developmentPoints, CONSTRUCTION_DEVELOPMENT_POINTS);
        set({
          plots,
          developmentPoints: nextPoints,
          levelUpEvents: crossedLevels.length > 0 ? [...get().levelUpEvents, ...crossedLevels] : get().levelUpEvents,
        });
        return true;
      },

      addDevelopmentPoints: (amount) => {
        const { nextPoints, crossedLevels } = applyPoints(get().developmentPoints, amount);
        set({
          developmentPoints: nextPoints,
          levelUpEvents: crossedLevels.length > 0 ? [...get().levelUpEvents, ...crossedLevels] : get().levelUpEvents,
        });
      },

      addReputation: (amount) => set((s) => ({ reputation: s.reputation + amount })),
    }),
    {
      name: 'tororo-dungeon-town-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export function getPlotState(plots: Record<string, TownPlotState>, plotId: string, unlockedByDefault: boolean): TownPlotState {
  return plots[plotId] ?? { id: plotId, unlocked: unlockedByDefault, building: null, constructedBuildingId: null };
}
