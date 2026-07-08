import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { MaterialId, PlayerState } from '../types';
import { STAGES, getStageDef, getNextStageId } from '../data/stages';
import { CHARACTERS } from '../data/characters';
import { STAMINA_MAX, STAMINA_REGEN_MS, STARTING_MATERIALS } from '../game/config';

interface PlayerActions {
  regenStamina: () => void;
  trySpendStamina: (amount: number) => boolean;
  addMaterials: (rewards: Partial<Record<MaterialId, number>>) => void;
  clearStage: (stageId: string) => void;
  collectTreasure: (stageId: string, material: MaterialId, amount: number) => void;
  isStageUnlocked: (stageId: string) => boolean;
}

type PlayerStore = PlayerState & PlayerActions;

const initialState: PlayerState = {
  stamina: STAMINA_MAX,
  staminaMax: STAMINA_MAX,
  staminaLastUpdated: Date.now(),
  materials: { ...STARTING_MATERIALS },
  characters: CHARACTERS.map((c) => ({ defId: c.id, level: 1 })),
  stageProgress: {},
  unlockedStageIds: [STAGES[0].id],
};

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      regenStamina: () => {
        const { stamina, staminaMax, staminaLastUpdated } = get();
        if (stamina >= staminaMax) {
          set({ staminaLastUpdated: Date.now() });
          return;
        }
        const elapsed = Date.now() - staminaLastUpdated;
        const gained = Math.floor(elapsed / STAMINA_REGEN_MS);
        if (gained <= 0) return;
        const next = Math.min(staminaMax, stamina + gained);
        const remainder = elapsed - gained * STAMINA_REGEN_MS;
        set({ stamina: next, staminaLastUpdated: Date.now() - remainder });
      },

      trySpendStamina: (amount) => {
        const { stamina } = get();
        if (stamina < amount) return false;
        set({ stamina: stamina - amount });
        return true;
      },

      addMaterials: (rewards) => {
        const { materials } = get();
        const next = { ...materials };
        (Object.keys(rewards) as MaterialId[]).forEach((key) => {
          next[key] = (next[key] ?? 0) + (rewards[key] ?? 0);
        });
        set({ materials: next });
      },

      clearStage: (stageId) => {
        const stage = getStageDef(stageId);
        const { stageProgress, unlockedStageIds } = get();
        const prevProgress = stageProgress[stageId];
        const nextProgress = {
          ...stageProgress,
          [stageId]: {
            cleared: true,
            treasureCollected: prevProgress?.treasureCollected ?? false,
          },
        };
        const nextStageId = getNextStageId(stageId);
        const nextUnlocked =
          nextStageId && !unlockedStageIds.includes(nextStageId)
            ? [...unlockedStageIds, nextStageId]
            : unlockedStageIds;
        set({ stageProgress: nextProgress, unlockedStageIds: nextUnlocked });
        get().addMaterials({ [stage.clearRewardMaterial]: stage.clearRewardAmount });
      },

      collectTreasure: (stageId, material, amount) => {
        const { stageProgress } = get();
        set({
          stageProgress: {
            ...stageProgress,
            [stageId]: {
              cleared: stageProgress[stageId]?.cleared ?? false,
              treasureCollected: true,
            },
          },
        });
        get().addMaterials({ [material]: amount });
      },

      isStageUnlocked: (stageId) => get().unlockedStageIds.includes(stageId),
    }),
    {
      name: 'tororo-dungeon-player',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
