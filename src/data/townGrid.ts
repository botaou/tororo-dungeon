import { BuildingKind, TownPlotDef } from '../types';
import { TOWN_X, TOWN_Y } from './world';

// A small grid of buildable land around the town hall (the existing 🏘️
// marker, which sits on the center cell and isn't a plot itself). Only a
// single ring fits: some enemies patrol as close as ~0.16 from town center,
// so a wider grid would visually collide with the field. The 4 orthogonal
// (N/S/E/W) plots start unlocked; the 4 diagonal corners cost gold + a
// material to claim, so the town still visibly grows as the player expands.
const CELL_W = 0.135;
const CELL_H = 0.1;

function buildPlotDefs(): TownPlotDef[] {
  const defs: TownPlotDef[] = [];
  const materialCycle: Array<'wood' | 'ore' | 'mushroom' | 'berry'> = ['wood', 'ore', 'mushroom', 'berry'];
  let materialIndex = 0;

  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      if (row === 0 && col === 0) continue; // town hall cell, not a plot

      const unlockedByDefault = row === 0 || col === 0; // orthogonal neighbors
      const x = TOWN_X + col * CELL_W;
      const y = TOWN_Y + row * CELL_H;

      let unlockCost: TownPlotDef['unlockCost'] = null;
      if (!unlockedByDefault) {
        const materialId = materialCycle[materialIndex % materialCycle.length];
        materialIndex += 1;
        unlockCost = { gold: 150, materialId, materialAmount: 8 };
      }

      defs.push({ id: `plot_${row}_${col}`, x, y, unlockedByDefault, unlockCost });
    }
  }
  return defs;
}

export const TOWN_PLOT_DEFS: TownPlotDef[] = buildPlotDefs();

export const BUILDING_ICON: Record<BuildingKind, string> = {
  workshop: '🛠️',
  shop: '🏪',
  warehouse: '📦',
};

// Cycle order when tapping an empty/occupied unlocked plot.
export const BUILDING_CYCLE: (BuildingKind | null)[] = [null, 'workshop', 'shop', 'warehouse'];
