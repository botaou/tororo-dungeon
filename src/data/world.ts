import { EnemyDef, MiningNodeDef, TreasureNodeDef } from '../types';

// The town sits at the center of the world; everything else is scattered
// across the surrounding field (forest/mine/lake/ruins flavor, but
// mechanically just one continuous area for this first pass).
export const TOWN_X = 0.5;
export const TOWN_Y = 0.5;
export const TOWN_RADIUS = 0.12;

export const ENEMY_DEFS: EnemyDef[] = [
  { id: 'slime_a', name: 'スライム', emoji: '🟢', hp: 30, atk: 3, goldReward: 8 },
  { id: 'slime_b', name: 'スライム', emoji: '🟢', hp: 30, atk: 3, goldReward: 8 },
  { id: 'bat_a', name: 'コウモリ', emoji: '🦇', hp: 25, atk: 4, goldReward: 10 },
  { id: 'wolf_a', name: 'オオカミ', emoji: '🐺', hp: 45, atk: 6, goldReward: 16 },
];

export const MINING_NODE_DEFS: MiningNodeDef[] = [
  { id: 'wood_1', name: '木', resource: 'wood', amount: 8 },
  { id: 'wood_2', name: '木', resource: 'wood', amount: 8 },
  { id: 'ore_1', name: '岩', resource: 'ore', amount: 6 },
  { id: 'ore_2', name: '岩', resource: 'ore', amount: 6 },
  { id: 'mushroom_1', name: 'キノコ', resource: 'mushroom', amount: 5 },
  { id: 'mushroom_2', name: 'キノコ', resource: 'mushroom', amount: 5 },
];

export const TREASURE_DEFS: TreasureNodeDef[] = [
  { id: 'treasure_1', name: '古い宝箱', goldReward: 150 },
];
