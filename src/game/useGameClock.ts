import { useEffect } from 'react';

import { useWorldStore } from '../store/useWorldStore';
import { TICK_MS } from './config';

// Single global ticker driving the whole persistent world: bird AI,
// combat, mood refresh, and job fulfillment all advance here.
export function useGameClock() {
  useEffect(() => {
    const id = setInterval(() => {
      useWorldStore.getState().tick();
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);
}
