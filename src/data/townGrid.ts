import { BuildingKind, TownPlotDef } from '../types';
import { TOWN_X, TOWN_Y } from './world';

// A grid of buildable land around the town hall (the existing 🏘️ marker,
// which sits on the center cell and isn't a plot itself). Two rings fit —
// the field's closest enemies/resources were nudged slightly further from
// town center to make room. The 4 orthogonal (N/S/E/W) ring-1 plots start
// unlocked; everything else (the 4 ring-1 diagonals, plus the 16 ring-2
// plots) costs gold + a material to claim, scaling with ring distance, so
// the town keeps visibly growing well past the first few plots.
const CELL_W = 0.195;
const CELL_H = 0.1;

function buildPlotDefs(): TownPlotDef[] {
  const defs: TownPlotDef[] = [];
  const materialCycle: Array<'wood' | 'ore' | 'mushroom' | 'berry'> = ['wood', 'ore', 'mushroom', 'berry'];
  let materialIndex = 0;

  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      if (row === 0 && col === 0) continue; // town hall cell, not a plot

      const ringDist = Math.max(Math.abs(row), Math.abs(col));
      const unlockedByDefault = ringDist <= 1 && (row === 0 || col === 0); // orthogonal ring-1 neighbors
      const x = TOWN_X + col * CELL_W;
      const y = TOWN_Y + row * CELL_H;

      let unlockCost: TownPlotDef['unlockCost'] = null;
      if (!unlockedByDefault) {
        const materialId = materialCycle[materialIndex % materialCycle.length];
        materialIndex += 1;
        unlockCost = { gold: 150 * ringDist, materialId, materialAmount: 8 * ringDist };
      }

      defs.push({ id: `plot_${row}_${col}`, x, y, unlockedByDefault, unlockCost });
    }
  }
  return defs;
}

export const TOWN_PLOT_DEFS: TownPlotDef[] = buildPlotDefs();

// The south ring-1 plot is a real, always-present shop rather than an
// empty player-buildable lot — the town always has at least one working
// (well, tappable) building in it from the start, per the request that
// the town shouldn't be 100% player-built. Its contents are a placeholder
// for now; the buy/sell system comes later.
export const SHOP_PLOT_ID = 'plot_1_0';

export const BUILDING_ICON: Record<BuildingKind, string> = {
  workshop: '🛠️',
  shop: '🏪',
  warehouse: '📦',
};

// Cycle order when tapping an empty/occupied unlocked plot.
export const BUILDING_CYCLE: (BuildingKind | null)[] = [null, 'workshop', 'shop', 'warehouse'];
