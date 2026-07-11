import { BuildingKind, ShopKind, TownPlotDef } from '../types';
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

// The north and south ring-1 plots are real, always-present shops rather
// than empty player-buildable lots — the town always has at least a
// couple of working (well, tappable) buildings in it from the start, per
// the request that the town shouldn't be 100% player-built.
export const SHOP_PLOT_ID = 'plot_1_0'; // south — general goods (道具屋)
export const FEED_SHOP_PLOT_ID = 'plot_-1_0'; // north — feed shop (餌屋)

export const SHOP_PLOT_IDS: Record<ShopKind, string> = {
  general: SHOP_PLOT_ID,
  feed: FEED_SHOP_PLOT_ID,
};

export function getShopPosition(kind: ShopKind): { x: number; y: number } {
  const def = TOWN_PLOT_DEFS.find((d) => d.id === SHOP_PLOT_IDS[kind])!;
  return { x: def.x, y: def.y };
}

// Where the visiting merchant sets up — a fixed spot off the buildable
// grid's diagonal plots, southeast of the town hall, clear of both
// permanent shops (which sit on the N/S axis). Not a real plot: nothing
// is ever built here, it's just where the temporary stall appears/vanishes.
export const MERCHANT_SPOT = { x: TOWN_X + 0.11, y: TOWN_Y + 0.11 };

export function shopKindForPlot(plotId: string): ShopKind | null {
  return (Object.keys(SHOP_PLOT_IDS) as ShopKind[]).find((k) => SHOP_PLOT_IDS[k] === plotId) ?? null;
}

export const BUILDING_ICON: Record<BuildingKind, string> = {
  workshop: '🛠️',
  shop: '🏪',
  warehouse: '📦',
};

// Cycle order when tapping an empty/occupied unlocked plot.
export const BUILDING_CYCLE: (BuildingKind | null)[] = [null, 'workshop', 'shop', 'warehouse'];
