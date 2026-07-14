import { MaterialId } from '../types';
import { BIRD_INVENTORY_CAP } from './config';

// Shared by every place a bird can gain materials (free-roam carrying,
// mining-node bonus drops, combat drops, offline catch-up) — a bird's
// basket has a hard limit, so gaining material past BIRD_INVENTORY_CAP
// just doesn't fit; the excess is left behind rather than picked up.
//
// This replaced an earlier "soft threshold" design (accumulate freely, but
// force an urgent sell trip once over the cap): once a bird's backlog got
// large, that forced sell would perpetually race the player's own gold
// income, buying back material the instant any gold appeared — the player
// never saw their own treasury actually grow, and selling never seemed to
// end (real-device report). A hard cap at the point of gain means overflow
// past 150 simply can't happen again, so there's nothing left to force a
// sale to catch up on.
export function totalInventoryAmount(inventory: Partial<Record<MaterialId, number>>): number {
  return Object.values(inventory).reduce((sum, amount) => sum + (amount ?? 0), 0);
}

export function addCappedInventory(
  inventory: Partial<Record<MaterialId, number>>,
  materialId: MaterialId,
  amount: number
): void {
  if (amount <= 0) return;
  const headroom = BIRD_INVENTORY_CAP - totalInventoryAmount(inventory);
  if (headroom <= 0) return;
  const added = Math.min(amount, headroom);
  inventory[materialId] = (inventory[materialId] ?? 0) + added;
}
