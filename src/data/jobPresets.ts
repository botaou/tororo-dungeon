import { ItemId, JobKind, MaterialId } from '../types';
import { MATERIAL_ICON, MATERIAL_LABEL } from './materials';
import { ITEM_DEF_MAP } from './items';
import { ENEMY_DEFS } from './world';

// The request board's fixed catalog — a tap instead of a number-entry form,
// and also the pool useWorldStore draws from when auto-refilling a slot
// after a request is completed (see MAX_ACTIVE_REQUESTS in game/config.ts).
// Exactly one of materialId/enemyName/itemId is set, matching `kind` (same
// convention as JobRequest — see types.ts). The three reward fields beyond
// gold are scaled roughly with it: expReward ~= reward/3, developmentPoints
// ~= reward/2.5, reputationPoints ~= reward/5 — light numbers, tunable later.
export interface JobPreset {
  kind: JobKind;
  materialId: MaterialId | null;
  enemyName: string | null;
  itemId: ItemId | null;
  amount: number;
  reward: number;
  expReward: number;
  developmentPoints: number;
  reputationPoints: number;
}

export const JOB_PRESETS: JobPreset[] = [
  // ---- gather: deliver N of a material (birds gather it themselves) ----
  { kind: 'gather', materialId: 'wood', enemyName: null, itemId: null, amount: 5, reward: 20, expReward: 7, developmentPoints: 8, reputationPoints: 4 },
  { kind: 'gather', materialId: 'ore', enemyName: null, itemId: null, amount: 5, reward: 30, expReward: 10, developmentPoints: 12, reputationPoints: 6 },
  { kind: 'gather', materialId: 'mushroom', enemyName: null, itemId: null, amount: 5, reward: 25, expReward: 8, developmentPoints: 10, reputationPoints: 5 },
  { kind: 'gather', materialId: 'berry', enemyName: null, itemId: null, amount: 5, reward: 22, expReward: 7, developmentPoints: 9, reputationPoints: 4 },
  { kind: 'gather', materialId: 'herb', enemyName: null, itemId: null, amount: 4, reward: 28, expReward: 9, developmentPoints: 11, reputationPoints: 6 },
  { kind: 'gather', materialId: 'feather', enemyName: null, itemId: null, amount: 3, reward: 26, expReward: 9, developmentPoints: 10, reputationPoints: 5 },
  { kind: 'gather', materialId: 'gem', enemyName: null, itemId: null, amount: 3, reward: 45, expReward: 15, developmentPoints: 18, reputationPoints: 9 },
  { kind: 'gather', materialId: 'coal', enemyName: null, itemId: null, amount: 5, reward: 24, expReward: 8, developmentPoints: 10, reputationPoints: 5 },
  { kind: 'gather', materialId: 'fish', enemyName: null, itemId: null, amount: 5, reward: 24, expReward: 8, developmentPoints: 10, reputationPoints: 5 },
  { kind: 'gather', materialId: 'pearl', enemyName: null, itemId: null, amount: 2, reward: 50, expReward: 17, developmentPoints: 20, reputationPoints: 10 },
  { kind: 'gather', materialId: 'waterweed', enemyName: null, itemId: null, amount: 4, reward: 20, expReward: 7, developmentPoints: 8, reputationPoints: 4 },
  { kind: 'gather', materialId: 'relic', enemyName: null, itemId: null, amount: 2, reward: 55, expReward: 18, developmentPoints: 22, reputationPoints: 11 },
  { kind: 'gather', materialId: 'magicStone', enemyName: null, itemId: null, amount: 2, reward: 60, expReward: 20, developmentPoints: 24, reputationPoints: 12 },
  { kind: 'gather', materialId: 'oldCoin', enemyName: null, itemId: null, amount: 4, reward: 35, expReward: 12, developmentPoints: 14, reputationPoints: 7 },

  // ---- hunt: defeat N of a specific enemy species ----
  { kind: 'hunt', materialId: null, enemyName: 'スライム', itemId: null, amount: 3, reward: 32, expReward: 11, developmentPoints: 13, reputationPoints: 6 },
  { kind: 'hunt', materialId: null, enemyName: 'コウモリ', itemId: null, amount: 3, reward: 38, expReward: 13, developmentPoints: 15, reputationPoints: 8 },
  { kind: 'hunt', materialId: null, enemyName: 'オオカミ', itemId: null, amount: 2, reward: 50, expReward: 17, developmentPoints: 20, reputationPoints: 10 },

  // ---- craft: craft N of a specific item at any shop's crafting panel ----
  { kind: 'craft', materialId: null, enemyName: null, itemId: 'rustySword', amount: 1, reward: 45, expReward: 15, developmentPoints: 18, reputationPoints: 9 },
  { kind: 'craft', materialId: null, enemyName: null, itemId: 'leatherArmor', amount: 1, reward: 40, expReward: 13, developmentPoints: 16, reputationPoints: 8 },
  { kind: 'craft', materialId: null, enemyName: null, itemId: 'leatherHat', amount: 1, reward: 32, expReward: 11, developmentPoints: 13, reputationPoints: 6 },
  { kind: 'craft', materialId: null, enemyName: null, itemId: 'woodenShield', amount: 1, reward: 38, expReward: 13, developmentPoints: 15, reputationPoints: 8 },

  // ---- merchantDeliver: deliver N of a specific item to the visiting
  // merchant while present — can't progress until one arrives ----
  { kind: 'merchantDeliver', materialId: null, enemyName: null, itemId: 'rustySword', amount: 1, reward: 55, expReward: 18, developmentPoints: 22, reputationPoints: 11 },
  { kind: 'merchantDeliver', materialId: null, enemyName: null, itemId: 'leatherArmor', amount: 1, reward: 50, expReward: 17, developmentPoints: 20, reputationPoints: 10 },
];

// Icon + label for whatever this request/preset targets, matching its
// `kind` — shared by RequestBoard's preset catalog and its active-request
// rows so both draw from one source of truth instead of duplicating the
// per-kind branching.
export function describeJobTarget(j: {
  kind: JobKind;
  materialId: MaterialId | null;
  enemyName: string | null;
  itemId: ItemId | null;
}): { icon: string; label: string } {
  switch (j.kind) {
    case 'gather':
      return { icon: MATERIAL_ICON[j.materialId!], label: MATERIAL_LABEL[j.materialId!] };
    case 'hunt': {
      const def = ENEMY_DEFS.find((e) => e.name === j.enemyName);
      return { icon: def?.emoji ?? '⚔️', label: j.enemyName ?? '' };
    }
    case 'craft':
    case 'merchantDeliver': {
      const def = ITEM_DEF_MAP[j.itemId!];
      return { icon: def.emoji, label: def.name };
    }
  }
}

// Short verb describing what "amount" counts, for progress labels.
export const JOB_KIND_UNIT_LABEL: Record<JobKind, string> = {
  gather: '個',
  hunt: '体討伐',
  craft: '個加工',
  merchantDeliver: '個納品',
};
