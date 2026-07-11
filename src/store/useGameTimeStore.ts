import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { OFFLINE_MIN_REPORT_MS, OFFLINE_PROGRESS_CAP_MS, ONLINE_TIME_SCALE } from '../game/config';
import { OfflineReport, simulateOfflineProgress } from '../game/offlineProgress';
import { usePlayerStore } from './usePlayerStore';
import { useBirdEconomyStore } from './useBirdEconomyStore';

interface GameTimeState {
  // Cosmetic in-game calendar total, in ms — see config.ts's
  // ONLINE_TIME_SCALE for why this isn't just real elapsed time.
  gameTimeMs: number;
  // Real epoch ms as of the last time we advanced gameTimeMs — read back on
  // the next launch to measure how long the app was actually closed.
  lastRealTimestampMs: number;
}

interface GameTimeActions {
  // Called once per tick while the app is open (see useWorldStore's tick).
  advanceOnline: (realDeltaMs: number) => void;
  // Called once at app startup, after every persisted store has hydrated.
  // Measures the real-world gap since lastRealTimestampMs, caps it, runs
  // the offline catch-up simulation, applies the results to the player/bird
  // stores, and returns a report to show the player — or null when there's
  // nothing worth reporting (first-ever launch, or too short a gap).
  catchUpOffline: () => OfflineReport | null;
}

export const useGameTimeStore = create<GameTimeState & GameTimeActions>()(
  persist(
    (set, get) => ({
      gameTimeMs: 0,
      lastRealTimestampMs: 0,

      advanceOnline: (realDeltaMs) => {
        set((s) => ({
          gameTimeMs: s.gameTimeMs + realDeltaMs * ONLINE_TIME_SCALE,
          lastRealTimestampMs: Date.now(),
        }));
      },

      catchUpOffline: () => {
        const { lastRealTimestampMs, gameTimeMs } = get();
        const now = Date.now();

        // First-ever launch — nothing to catch up on, just start the clock.
        if (lastRealTimestampMs === 0) {
          set({ lastRealTimestampMs: now });
          return null;
        }

        const realElapsedMs = Math.max(0, now - lastRealTimestampMs);
        if (realElapsedMs < OFFLINE_MIN_REPORT_MS) {
          set({ lastRealTimestampMs: now });
          return null;
        }

        const cappedRealElapsedMs = Math.min(realElapsedMs, OFFLINE_PROGRESS_CAP_MS);
        const wallets = useBirdEconomyStore.getState().wallets;
        const hasRecruited = Object.values(wallets).some((w) => w.isRecruited);

        // Nobody's joined the town yet — nothing to simulate, but the
        // calendar still advances for whenever a starter is picked.
        if (!hasRecruited) {
          set({ gameTimeMs: gameTimeMs + cappedRealElapsedMs * ONLINE_TIME_SCALE, lastRealTimestampMs: now });
          return null;
        }

        const materials = usePlayerStore.getState().materials;
        const playerGold = usePlayerStore.getState().gold;
        const report = simulateOfflineProgress(realElapsedMs, cappedRealElapsedMs, wallets, materials, playerGold);

        const nextWallets = { ...wallets };
        for (const outcome of report.birdOutcomes) {
          nextWallets[outcome.defId] = outcome.wallet;
        }
        useBirdEconomyStore.getState().syncAll(nextWallets);

        if (report.huntFeeIncome > 0) usePlayerStore.getState().creditHuntToll(report.huntFeeIncome);
        if (report.travelerIncome > 0) usePlayerStore.getState().creditTravelerToll(report.travelerIncome);
        // Buying materials birds sold offline is a real spend, already capped
        // against playerGold inside the simulation — not toll income (that's
        // credited above), just money out in exchange for warehouse stock.
        if (report.sellExpense > 0) usePlayerStore.getState().trySpendGold(report.sellExpense);
        if (Object.keys(report.materialsDelta).length > 0) {
          usePlayerStore.getState().addMaterials(report.materialsDelta);
        }

        set({ gameTimeMs: gameTimeMs + cappedRealElapsedMs * ONLINE_TIME_SCALE, lastRealTimestampMs: now });

        return report;
      },
    }),
    {
      name: 'tororo-dungeon-game-time-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
