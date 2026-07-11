import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// A generic, reusable place to remember "has this one-off thing happened
// yet" — today just the two recruitment milestones (see game/recruitment.ts's
// HAKU_QUEST_ID/MONE_WOLF_KILL_MILESTONE_ID), but deliberately not modeled
// as anything more specific than a completed-id set, so future quests don't
// need a schema change.
interface QuestState {
  completed: Record<string, boolean>;
}

interface QuestActions {
  isComplete: (id: string) => boolean;
  complete: (id: string) => void;
}

export const useQuestStore = create<QuestState & QuestActions>()(
  persist(
    (set, get) => ({
      completed: {},

      isComplete: (id) => !!get().completed[id],

      complete: (id) => {
        if (get().completed[id]) return; // already done, nothing to persist again
        set({ completed: { ...get().completed, [id]: true } });
      },
    }),
    {
      name: 'tororo-dungeon-quest-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
