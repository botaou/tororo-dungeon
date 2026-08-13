import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ActivityLogEntry, NewsArticle } from '../types';
import { NEWS_ARTICLE_ARCHIVE_MAX, NEWS_COLLECTED_ENTRIES_MAX } from '../game/config';
import { generateNewsArticle, todayKey } from '../game/newsGenerator';
import { useWorldStore } from './useWorldStore';

interface NewsState {
  articles: NewsArticle[]; // newest first, archived (one per calendar day that had one generated)
  // Raw entries collected since the last article was generated — newest
  // first, deliberately NOT capped at ACTIVITY_LOG_MAX like the on-screen
  // activityLog (see game/config.ts's own comment on NEWS_COLLECTED_ENTRIES_MAX).
  collectedEntries: ActivityLogEntry[];
  lastArticleDateKey: string;
}

interface NewsActions {
  // Appends any entries not already present (deduped by id) — called from
  // this file's own module-level useWorldStore subscription below, not
  // meant to be called directly from UI code.
  collectEntries: (entries: ActivityLogEntry[]) => void;
  // If the calendar date has rolled over since the last check, archives
  // everything collected under the old date into one article and starts a
  // fresh collection window. Safe/cheap to call as often as needed (a
  // same-day call is a no-op) — called on every world tick (see below), so
  // a rollover is caught within one tick whether the app was open across
  // midnight or just relaunched after several days away.
  checkAndGenerateArticle: () => void;
}

export const useNewsStore = create<NewsState & NewsActions>()(
  persist(
    (set, get) => ({
      articles: [],
      collectedEntries: [],
      lastArticleDateKey: todayKey(),

      collectEntries: (entries) => {
        if (entries.length === 0) return;
        const { collectedEntries } = get();
        const seenIds = new Set(collectedEntries.map((e) => e.id));
        const fresh = entries.filter((e) => !seenIds.has(e.id));
        if (fresh.length === 0) return;
        set({ collectedEntries: [...fresh, ...collectedEntries].slice(0, NEWS_COLLECTED_ENTRIES_MAX) });
      },

      checkAndGenerateArticle: () => {
        const { lastArticleDateKey, collectedEntries, articles } = get();
        const today = todayKey();
        if (today === lastArticleDateKey) return;
        // The app might have been closed for several real days at once —
        // this only ever archives ONE article, covering whatever was
        // actually collected under lastArticleDateKey (possibly nothing, if
        // the app was closed the whole time that date was "today"). It
        // deliberately does not try to backfill one article per skipped
        // calendar day in between — there's no activity data for those at
        // all, so a run of empty "特に大きな出来事はなかった" articles would
        // just be noise in the archive.
        const article = generateNewsArticle(lastArticleDateKey, collectedEntries);
        set({
          articles: [article, ...articles].slice(0, NEWS_ARTICLE_ARCHIVE_MAX),
          collectedEntries: [],
          lastArticleDateKey: today,
        });
      },
    }),
    {
      name: 'tororo-dungeon-news-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// Cross-store reaction, not a React effect: useWorldStore's own activityLog
// is capped at just ACTIVITY_LOG_MAX(=10) entries for on-screen display —
// nowhere near enough to reconstruct a whole day's worth of newspaper
// material — and is itself never persisted (rebuilt empty every app
// launch). Rather than touching every one of useWorldStore's many
// `activityLog: [...newEntries, ...world.activityLog].slice(...)` call
// sites to also feed this store, this subscribes once to ALL of
// useWorldStore's changes and diffs activityLog by entry id (ids are
// monotonically unique, see makeLogEntry) to find what's newly arrived
// since the last fire, then hands those off to collectEntries/
// checkAndGenerateArticle. The one edge case this doesn't cover: if a
// single set() call pushes more than ACTIVITY_LOG_MAX brand-new entries at
// once, the oldest of that burst are truncated away before this ever sees
// them — accepted as a rare, low-stakes loss (a couple of the least-recent
// headlines from an unusually busy single tick) rather than invasively
// editing every mutation site in useWorldStore.ts.
//
// Gated behind this store's own hydration (not just started immediately at
// module load) so a subscribe fire from an early world tick can never read
// a still-default in-memory lastArticleDateKey/collectedEntries and
// overwrite what's about to be restored from disk.
function startCollectingNews() {
  let previousIds = new Set(useWorldStore.getState().world.activityLog.map((e) => e.id));
  useWorldStore.subscribe((state) => {
    const entries = state.world.activityLog;
    const fresh = entries.filter((e) => !previousIds.has(e.id));
    previousIds = new Set(entries.map((e) => e.id));
    if (fresh.length > 0) useNewsStore.getState().collectEntries(fresh);
    useNewsStore.getState().checkAndGenerateArticle();
  });
}

if (useNewsStore.persist.hasHydrated()) {
  startCollectingNews();
} else {
  useNewsStore.persist.onFinishHydration(startCollectingNews);
}
