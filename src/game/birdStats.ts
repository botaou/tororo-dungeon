import { BirdState, EquipSlot, ItemId } from '../types';
import { ITEM_DEF_MAP } from '../data/items';
import { BIRD_SKILL_DEF_MAP } from '../data/skills';

const EQUIP_SLOTS: EquipSlot[] = ['weapon', 'armor', 'hat', 'shield'];

export interface EffectiveStats {
  atk: number;
  defense: number;
  speed: number;
  luck: number;
}

// Base stats plus whatever's currently equipped plus any permanent skills
// (see data/skills.ts) — the numbers actually used in combat and shown on
// the roster card. speed/luck aren't consumed by any mechanic yet (movement
// is still a flat global constant, and nothing rolls against luck), but
// they're computed the same way so wiring them in later is just changing the
// call site, not the data model.
export function getEffectiveStats(bird: BirdState): EffectiveStats {
  let atk = bird.atk;
  let defense = bird.defense;
  let speed = bird.speed;
  let luck = bird.luck;

  for (const slot of EQUIP_SLOTS) {
    const itemId = bird.equipment[slot];
    if (!itemId) continue;
    const bonus = ITEM_DEF_MAP[itemId].statBonus;
    if (!bonus) continue;
    atk += bonus.atk ?? 0;
    defense += bonus.defense ?? 0;
    speed += bonus.speed ?? 0;
    luck += bonus.luck ?? 0;
  }

  // A skill behaves like an invisible extra piece of equipment that can
  // never be unequipped — same merge, just over a different source list.
  for (const skillId of bird.skills) {
    const bonus = BIRD_SKILL_DEF_MAP[skillId]?.statBonus;
    if (!bonus) continue;
    atk += bonus.atk ?? 0;
    defense += bonus.defense ?? 0;
    speed += bonus.speed ?? 0;
    luck += bonus.luck ?? 0;
  }

  return { atk, defense, speed, luck };
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
