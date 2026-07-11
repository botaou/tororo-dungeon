import { MaterialId } from '../types';

// The request board's fixed catalog — a tap instead of a number-entry form,
// and also the pool useWorldStore draws from when auto-refilling a slot
// after a request is completed (see MAX_ACTIVE_REQUESTS in game/config.ts).
// The three new reward fields are scaled roughly with the existing gold
// reward: expReward ~= reward/3, developmentPoints ~= reward/2.5,
// reputationPoints ~= reward/5 — light numbers, tunable later.
export interface JobPreset {
  materialId: MaterialId;
  amount: number;
  reward: number;
  expReward: number;
  developmentPoints: number;
  reputationPoints: number;
}

export const JOB_PRESETS: JobPreset[] = [
  { materialId: 'wood', amount: 5, reward: 20, expReward: 7, developmentPoints: 8, reputationPoints: 4 },
  { materialId: 'ore', amount: 5, reward: 30, expReward: 10, developmentPoints: 12, reputationPoints: 6 },
  { materialId: 'mushroom', amount: 5, reward: 25, expReward: 8, developmentPoints: 10, reputationPoints: 5 },
  { materialId: 'berry', amount: 5, reward: 22, expReward: 7, developmentPoints: 9, reputationPoints: 4 },
  { materialId: 'herb', amount: 4, reward: 28, expReward: 9, developmentPoints: 11, reputationPoints: 6 },
  { materialId: 'feather', amount: 3, reward: 26, expReward: 9, developmentPoints: 10, reputationPoints: 5 },
  { materialId: 'gem', amount: 3, reward: 45, expReward: 15, developmentPoints: 18, reputationPoints: 9 },
  { materialId: 'coal', amount: 5, reward: 24, expReward: 8, developmentPoints: 10, reputationPoints: 5 },
  { materialId: 'fish', amount: 5, reward: 24, expReward: 8, developmentPoints: 10, reputationPoints: 5 },
  { materialId: 'pearl', amount: 2, reward: 50, expReward: 17, developmentPoints: 20, reputationPoints: 10 },
  { materialId: 'waterweed', amount: 4, reward: 20, expReward: 7, developmentPoints: 8, reputationPoints: 4 },
  { materialId: 'relic', amount: 2, reward: 55, expReward: 18, developmentPoints: 22, reputationPoints: 11 },
  { materialId: 'magicStone', amount: 2, reward: 60, expReward: 20, developmentPoints: 24, reputationPoints: 12 },
  { materialId: 'oldCoin', amount: 4, reward: 35, expReward: 12, developmentPoints: 14, reputationPoints: 7 },
];
