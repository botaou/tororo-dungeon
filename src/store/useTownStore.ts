import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BUILDING_CYCLE } from '../data/townGrid';
import { PlotUnlockCost, TownPlotState } from '../types';
import { usePlayerStore } from './usePlayerStore';

interface TownState {
  plots: Record<string, TownPlotState>;
}

interface TownActions {
  // Unlocking spends gold/material up front — the caller passes the def's
  // cost so this store doesn't need to import world data just to look it up.
  tryUnlockPlot: (plotId: string, cost: PlotUnlockCost) => boolean;
  cycleBuilding: (plotId: string) => void;
}

function ensurePlot(plots: Record<string, TownPlotState>, plotId: string, unlockedByDefault: boolean): TownPlotState {
  return plots[plotId] ?? { id: plotId, unlocked: unlockedByDefault, building: null };
}

export const useTownStore = create<TownState & TownActions>()(
  persist(
    (set, get) => ({
      plots: {},

      tryUnlockPlot: (plotId, cost) => {
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
        set({ plots });
        return true;
      },

      cycleBuilding: (plotId) => {
        const plots = { ...get().plots };
        const existing = plots[plotId];
        if (!existing || !existing.unlocked) return;
        const currentIndex = BUILDING_CYCLE.indexOf(existing.building);
        const next = BUILDING_CYCLE[(currentIndex + 1) % BUILDING_CYCLE.length];
        plots[plotId] = { ...existing, building: next };
        set({ plots });
      },
    }),
    {
      name: 'tororo-dungeon-town-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export function getPlotState(plots: Record<string, TownPlotState>, plotId: string, unlockedByDefault: boolean): TownPlotState {
  return plots[plotId] ?? { id: plotId, unlocked: unlockedByDefault, building: null };
}
