import { useEffect } from 'react';

import { usePlayerStore } from '../store/usePlayerStore';
import { useStageStore } from '../store/useStageStore';
import { TICK_MS } from './config';

// Single global ticker driving stamina regen and (when a map session is
// active) energy regen + auto-combat. Timestamp-based regen inside the
// stores means this stays correct even if ticks are skipped/delayed.
export function useGameClock() {
  useEffect(() => {
    const id = setInterval(() => {
      usePlayerStore.getState().regenStamina();
      if (useStageStore.getState().session) {
        useStageStore.getState().tick();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);
}
