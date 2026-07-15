import { BirdState, ItemId, MaterialId } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { BIRD_INVENTORY_CAP, EQUIPMENT_SALVAGE_FRACTION, EQUIPMENT_SPARE_CAP } from './config';

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

const EQUIP_CATEGORIES = ['weapon', 'armor', 'hat', 'shield'];

export interface CappedItemAddResult {
  added: number; // how many actually landed in bird.items
  salvageGold: number; // gold credited for whatever didn't fit (0 if none)
}

// Adds `amount` of an item to a bird's `items`. Non-equip categories (food,
// convertible treasure) are uncapped here, same as always — this only
// bites for weapon/armor/hat/shield, where a real-device report found 193
// spare copies of one weapon piled up from repeated combat drops (see
// EQUIPMENT_SPARE_CAP's comment in config.ts). Past the cap, the extra
// copy is auto-sold for gold on the spot (credited straight to the bird —
// no town split, unlike a real merchant sale, since this is closer to
// scrapping a duplicate than a real transaction) instead of just being
// discarded for nothing.
export function addItemCapped(bird: BirdState, itemId: ItemId, amount: number): CappedItemAddResult {
  const def = ITEM_DEF_MAP[itemId];
  if (!EQUIP_CATEGORIES.includes(def.category)) {
    bird.items[itemId] = (bird.items[itemId] ?? 0) + amount;
    return { added: amount, salvageGold: 0 };
  }
  let added = 0;
  let salvageGold = 0;
  for (let i = 0; i < amount; i++) {
    const owned = bird.items[itemId] ?? 0;
    if (owned >= EQUIPMENT_SPARE_CAP) {
      const salvage = Math.round(def.buyPrice * EQUIPMENT_SALVAGE_FRACTION);
      bird.gold += salvage;
      salvageGold += salvage;
    } else {
      bird.items[itemId] = owned + 1;
      added += 1;
    }
  }
  return { added, salvageGold };
}
