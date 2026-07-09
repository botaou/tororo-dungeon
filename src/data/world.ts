import { EnemyDef, LeisureSpotDef, MiningNodeDef, TreasureNodeDef } from '../types';

// The town sits at the center of the world; everything else is arranged in
// deliberate, natural-feeling zones around it (a forest to the northwest,
// a quarry to the northeast, a mushroom patch to the southwest, water
// features to the south) rather than scattered at random.
export const TOWN_X = 0.5;
export const TOWN_Y = 0.5;
export const TOWN_RADIUS = 0.12;

// Forest (wood + a couple of wandering slimes/wolf), upper-left.
export const ENEMY_DEFS: EnemyDef[] = [
  { id: 'slime_a', name: 'スライム', emoji: '🟢', hp: 30, atk: 3, goldReward: 8, x: 0.28, y: 0.33 },
  { id: 'slime_b', name: 'スライム', emoji: '🟢', hp: 30, atk: 3, goldReward: 8, x: 0.16, y: 0.66 },
  { id: 'bat_a', name: 'コウモリ', emoji: '🦇', hp: 25, atk: 4, goldReward: 10, x: 0.55, y: 0.16 },
  { id: 'wolf_a', name: 'オオカミ', emoji: '🐺', hp: 45, atk: 6, goldReward: 16, x: 0.82, y: 0.34 },
];

export const MINING_NODE_DEFS: MiningNodeDef[] = [
  // Forest — wood.
  { id: 'wood_1', name: '木', resource: 'wood', amount: 8, x: 0.2, y: 0.2 },
  { id: 'wood_2', name: '木', resource: 'wood', amount: 8, x: 0.32, y: 0.28 },
  // Quarry — ore, upper-right.
  { id: 'ore_1', name: '岩', resource: 'ore', amount: 6, x: 0.72, y: 0.2 },
  { id: 'ore_2', name: '岩', resource: 'ore', amount: 6, x: 0.8, y: 0.28 },
  // Damp mushroom patch, lower-left.
  { id: 'mushroom_1', name: 'キノコ', resource: 'mushroom', amount: 5, x: 0.18, y: 0.72 },
  { id: 'mushroom_2', name: 'キノコ', resource: 'mushroom', amount: 5, x: 0.28, y: 0.8 },
];

// Old ruins along the north edge, between the forest and the quarry.
export const TREASURE_DEFS: TreasureNodeDef[] = [
  { id: 'treasure_1', name: '古い宝箱', goldReward: 150, x: 0.5, y: 0.12 },
];

// Always-available leisure spots — not consumable, just somewhere an
// otherwise-idle bird can go relax. Both sit south of town near each other,
// like a little waterside area.
export const LEISURE_SPOT_DEFS: LeisureSpotDef[] = [
  { id: 'river_1', name: '川', emoji: '🌊', kind: 'river', x: 0.72, y: 0.82 },
  { id: 'pond_1', name: '池', emoji: '🪷', kind: 'pond', x: 0.45, y: 0.88 },
];

// Purely decorative foliage ringing the town — no gameplay effect, just
// makes the home base read as a cozy little village instead of a bare box.
export const TOWN_DECOR: { emoji: string; x: number; y: number }[] = [
  { emoji: '🌳', x: TOWN_X - 0.13, y: TOWN_Y - 0.09 },
  { emoji: '🌳', x: TOWN_X + 0.14, y: TOWN_Y - 0.08 },
  { emoji: '🌸', x: TOWN_X - 0.1, y: TOWN_Y + 0.1 },
  { emoji: '🌷', x: TOWN_X + 0.11, y: TOWN_Y + 0.1 },
  { emoji: '🌼', x: TOWN_X - 0.02, y: TOWN_Y - 0.13 },
  { emoji: '🌳', x: TOWN_X + 0.02, y: TOWN_Y + 0.13 },
];
