import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COSMETIC_ITEMS } from '../data/cosmetics';

interface CosmeticState {
  // Ids (CosmeticItemDef.id) any bird can currently wear — starts with just
  // the defaults (see COSMETIC_ITEMS' unlockedByDefault) and only ever
  // grows. Global/shared, not per-bird, matching this whole feature's "one
  // image reused across all 4 birds" design (see data/cosmetics.ts).
  unlockedCosmeticIds: string[];
  // Costume "tickets" — obtained via find/drop/craft (game/cosmeticUnlocks.ts)
  // but not yet spent to unlock the costume for wearing. Conceptually a
  // player-warehouse item, kept in its own store (rather than folded into
  // usePlayerStore.items) since it's keyed by cosmetic id, not ItemId.
  ticketCounts: Partial<Record<string, number>>;
}

interface CosmeticActions {
  isCosmeticUnlocked: (cosmeticId: string) => boolean;
  // Adds one ticket for cosmeticId — a no-op (still returns true) if the
  // costume is already unlocked, since there's nothing left to gift it
  // toward; callers (game/cosmeticUnlocks.ts) already filter these out
  // before rolling, so this is just a defensive second check.
  addTicket: (cosmeticId: string) => boolean;
  // Spends one ticket to unlock the costume globally. Returns false if
  // there's no ticket to spend or it's already unlocked.
  giftCosmetic: (cosmeticId: string) => boolean;
}

export const useCosmeticStore = create<CosmeticState & CosmeticActions>()(
  persist(
    (set, get) => ({
      unlockedCosmeticIds: COSMETIC_ITEMS.filter((c) => c.unlockedByDefault).map((c) => c.id),
      ticketCounts: {},

      isCosmeticUnlocked: (cosmeticId) => get().unlockedCosmeticIds.includes(cosmeticId),

      addTicket: (cosmeticId) => {
        if (!COSMETIC_ITEMS.some((c) => c.id === cosmeticId)) return false;
        if (get().unlockedCosmeticIds.includes(cosmeticId)) return true;
        set((s) => ({ ticketCounts: { ...s.ticketCounts, [cosmeticId]: (s.ticketCounts[cosmeticId] ?? 0) + 1 } }));
        return true;
      },

      giftCosmetic: (cosmeticId) => {
        const { unlockedCosmeticIds, ticketCounts } = get();
        if (unlockedCosmeticIds.includes(cosmeticId)) return false;
        const owned = ticketCounts[cosmeticId] ?? 0;
        if (owned <= 0) return false;
        set({
          unlockedCosmeticIds: [...unlockedCosmeticIds, cosmeticId],
          ticketCounts: { ...ticketCounts, [cosmeticId]: owned - 1 },
        });
        return true;
      },
    }),
    {
      name: 'tororo-dungeon-cosmetic-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
