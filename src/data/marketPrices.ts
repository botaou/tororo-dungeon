import { MaterialId } from '../types';

// Fixed rate the player pays per unit when buying a material out of a
// bird's personal stash at the shop — simple flat table for now, no
// haggling or fluctuation. Roughly scaled by how rare/slow each material
// is to gather (mirrors the request-board preset rewards from earlier).
export const MATERIAL_SELL_PRICE: Record<MaterialId, number> = {
  wood: 4,
  ore: 6,
  mushroom: 5,
  berry: 4,
  herb: 7,
  feather: 9,
  gem: 15,
  coal: 5,
  fish: 5,
  pearl: 25,
  waterweed: 5,
  relic: 28,
  magicStone: 30,
  oldCoin: 9,
};

export function computeSaleValue(inventory: Partial<Record<MaterialId, number>>): number {
  let total = 0;
  for (const [key, amount] of Object.entries(inventory) as [MaterialId, number][]) {
    total += (amount ?? 0) * (MATERIAL_SELL_PRICE[key] ?? 0);
  }
  return total;
}
