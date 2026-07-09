import { EnemyDef, LeisureSpotDef, MiningNodeDef, TreasureNodeDef } from '../types';

// The town sits at the center of the world; everything else is arranged in
// deliberate, natural-feeling zones around it (a forest to the northwest,
// a quarry to the northeast, a mushroom patch to the southwest, water
// features to the south) rather than scattered at random.
export const TOWN_X = 0.5;
export const TOWN_Y = 0.5;
export const TOWN_RADIUS = 0.12;

// Forest (wood + a couple of wandering slimes/wolf), upper-left. Positions
// here are nudged slightly further from town versus earlier revisions to
// leave room for a bigger buildable land grid around the town hall.
// expReward is a flat grant to every bird that damaged the enemy (not split
// like gold) — tiered roughly with difficulty; a future boss tier would
// just need a much larger value here, no structural changes.
export const ENEMY_DEFS: EnemyDef[] = [
  { id: 'slime_a', name: 'スライム', emoji: '🟢', hp: 30, atk: 3, goldReward: 8, expReward: 5, x: 0.231, y: 0.292 },
  { id: 'slime_b', name: 'スライム', emoji: '🟢', hp: 30, atk: 3, goldReward: 8, expReward: 5, x: 0.16, y: 0.66 },
  { id: 'bat_a', name: 'コウモリ', emoji: '🦇', hp: 25, atk: 4, goldReward: 10, expReward: 7, x: 0.55, y: 0.16 },
  { id: 'wolf_a', name: 'オオカミ', emoji: '🐺', hp: 45, atk: 6, goldReward: 16, expReward: 10, x: 0.82, y: 0.34 },
];

export const MINING_NODE_DEFS: MiningNodeDef[] = [
  // Forest — wood, plus its undergrowth (berries/herbs) and birds' feathers.
  { id: 'wood_1', name: '木', resource: 'wood', amount: 8, x: 0.2, y: 0.2 },
  { id: 'wood_2', name: '木', resource: 'wood', amount: 8, x: 0.285, y: 0.237 },
  { id: 'berry_1', name: '木の実', resource: 'berry', amount: 6, x: 0.24, y: 0.24 },
  { id: 'herb_1', name: '薬草', resource: 'herb', amount: 4, x: 0.28, y: 0.14 },
  { id: 'feather_1', name: '羽根', resource: 'feather', amount: 3, x: 0.3, y: 0.18 },
  // Quarry — ore, plus deeper gems and coal seams, upper-right.
  { id: 'ore_1', name: '岩', resource: 'ore', amount: 6, x: 0.72, y: 0.2 },
  { id: 'ore_2', name: '岩', resource: 'ore', amount: 6, x: 0.8, y: 0.28 },
  { id: 'gem_1', name: '宝石', resource: 'gem', amount: 3, x: 0.78, y: 0.18 },
  { id: 'coal_1', name: '石炭', resource: 'coal', amount: 5, x: 0.727, y: 0.247 },
  // Damp mushroom patch, lower-left.
  { id: 'mushroom_1', name: 'キノコ', resource: 'mushroom', amount: 5, x: 0.18, y: 0.72 },
  { id: 'mushroom_2', name: 'キノコ', resource: 'mushroom', amount: 5, x: 0.28, y: 0.8 },
  // Lake — fish, pearls, waterweed, around the river/pond leisure spots.
  { id: 'fish_1', name: '魚', resource: 'fish', amount: 5, x: 0.65, y: 0.85 },
  { id: 'pearl_1', name: '真珠', resource: 'pearl', amount: 2, x: 0.78, y: 0.9 },
  { id: 'waterweed_1', name: '水草', resource: 'waterweed', amount: 4, x: 0.521, y: 0.839 },
  // Ruins — relics, magic stones, old coins, around the treasure chest.
  { id: 'relic_1', name: '遺物', resource: 'relic', amount: 2, x: 0.42, y: 0.14 },
  { id: 'magicStone_1', name: '魔石', resource: 'magicStone', amount: 2, x: 0.58, y: 0.1 },
  { id: 'oldCoin_1', name: '古いコイン', resource: 'oldCoin', amount: 4, x: 0.5, y: 0.16 },
];

// Old ruins along the north edge, between the forest and the quarry.
export const TREASURE_DEFS: TreasureNodeDef[] = [
  { id: 'treasure_1', name: '古い宝箱', goldReward: 150, x: 0.5, y: 0.12 },
];

// Always-available leisure spots — not consumable, just somewhere an
// otherwise-idle bird can go relax. Both sit south of town near each other,
// like a little waterside area (which doubles as the lake resource zone).
export const LEISURE_SPOT_DEFS: LeisureSpotDef[] = [
  { id: 'river_1', name: '川', emoji: '🌊', kind: 'river', x: 0.72, y: 0.82 },
  { id: 'pond_1', name: '池', emoji: '🪷', kind: 'pond', x: 0.45, y: 0.88 },
];

// Purely decorative foliage just beyond the land grid's corners — no
// gameplay effect, just makes the (now much bigger) town read as a cozy
// village edge instead of a bare grid of plots.
export const TOWN_DECOR: { emoji: string; x: number; y: number }[] = [
  { emoji: '🌳', x: TOWN_X - 0.2, y: TOWN_Y - 0.15 },
  { emoji: '🌳', x: TOWN_X + 0.2, y: TOWN_Y - 0.15 },
  { emoji: '🌸', x: TOWN_X - 0.2, y: TOWN_Y + 0.15 },
  { emoji: '🌷', x: TOWN_X + 0.2, y: TOWN_Y + 0.15 },
];
