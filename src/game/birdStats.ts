import { BirdState, EquipSlot, ItemId, ItemStatBonus } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { BIRD_SKILL_DEF_MAP } from '../data/skills';
import { EQUIPMENT_SETS } from '../data/equipmentSets';

const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'head', 'body', 'hand', 'foot'];

export interface EffectiveStats {
  atk: number;
  defense: number;
  speed: number;
  luck: number;
  // New alongside the equipment expansion (see types.ts's ItemStatBonus
  // comment) — real numbers, shown on the roster card, but — like speed/
  // luck already were before this pass — not consumed by any mechanic yet
  // (no MP resource, no crit/evasion roll in combat). maxHp folds any gear
  // hp bonus into the wearer's own maxHp instead of being a separate field,
  // since maxHp already existed as a real (not display-only) stat.
  maxHp: number;
  mp: number;
  cri: number;
  eva: number;
  // Label of the highest-tier set bonus currently active, if any (see
  // data/equipmentSets.ts) — null when the wearer doesn't have enough
  // matching pieces equipped for even the lowest tier. Purely for display;
  // the actual bonus is already folded into the stats above.
  activeSetBonusLabel: string | null;
}

function addBonus(target: { atk: number; defense: number; speed: number; luck: number; maxHp: number; mp: number; cri: number; eva: number }, bonus: ItemStatBonus | undefined) {
  if (!bonus) return;
  target.atk += bonus.atk ?? 0;
  target.defense += bonus.defense ?? 0;
  target.speed += bonus.speed ?? 0;
  target.luck += bonus.luck ?? 0;
  target.maxHp += bonus.hp ?? 0;
  target.mp += bonus.mp ?? 0;
  target.cri += bonus.cri ?? 0;
  target.eva += bonus.eva ?? 0;
}

// Checks how many of a bird's currently-equipped items belong to each
// EquipmentSetDef and returns the highest bonus tier reached (or null if
// none) — tiers aren't cumulative, only the best-qualifying one applies
// (see EquipmentSetBonusTier's comment in types.ts).
function getActiveSetBonus(equippedIds: ItemId[]): { statBonus: ItemStatBonus; label: string } | null {
  let best: { statBonus: ItemStatBonus; label: string; piecesRequired: number } | null = null;
  for (const set of EQUIPMENT_SETS) {
    const wornCount = set.itemIds.filter((id) => equippedIds.includes(id)).length;
    for (const tier of set.bonusTiers) {
      if (wornCount < tier.piecesRequired) continue;
      if (!best || tier.piecesRequired > best.piecesRequired) {
        best = { statBonus: tier.statBonus, label: tier.label, piecesRequired: tier.piecesRequired };
      }
    }
  }
  return best;
}

// Base stats plus whatever's currently equipped, any active equipment-set
// bonus (see data/equipmentSets.ts), plus any permanent skills (see
// data/skills.ts) — the numbers actually used in combat and shown on the
// roster card.
export function getEffectiveStats(bird: BirdState): EffectiveStats {
  const totals = { atk: bird.atk, defense: bird.defense, speed: bird.speed, luck: bird.luck, maxHp: bird.maxHp, mp: 0, cri: 0, eva: 0 };

  const equippedIds: ItemId[] = [];
  for (const slot of EQUIP_SLOTS) {
    const itemId = bird.equipment[slot];
    if (!itemId) continue;
    equippedIds.push(itemId);
    addBonus(totals, ITEM_DEF_MAP[itemId].statBonus);
  }

  const setBonus = getActiveSetBonus(equippedIds);
  if (setBonus) addBonus(totals, setBonus.statBonus);

  // A skill behaves like an invisible extra piece of equipment that can
  // never be unequipped — same merge, just over a different source list.
  for (const skillId of bird.skills) {
    addBonus(totals, BIRD_SKILL_DEF_MAP[skillId]?.statBonus);
  }

  return { ...totals, activeSetBonusLabel: setBonus?.label ?? null };
}

// Called whenever a bird's `items` gains an equippable item (shop purchase
// or monster drop). Fills the matching slot only if it's currently empty —
// never bumps out something already equipped, so an extra copy just sits
// unequipped as a spare rather than forcing a swap decision.
export function maybeAutoEquip(bird: BirdState, itemId: ItemId): void {
  const category = ITEM_DEF_MAP[itemId].category;
  if (!isEquipSlot(category)) return;
  if (bird.equipment[category]) return;
  bird.equipment[category] = itemId;
}

function isEquipSlot(category: string): category is EquipSlot {
  return (EQUIP_SLOTS as string[]).includes(category);
}
