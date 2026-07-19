import { DropEntry, EnemyDef, LeisureSpotDef, MiningNodeDef, TreasureNodeDef } from '../types';

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
// Drop tables scale roughly with difficulty: weaker/common enemies mostly
// drop a bit of extra material with a rare chance at basic gear; the
// tougher wolves have better odds at rarer loot. Each entry rolls
// independently, so a single kill can drop more than one thing (or nothing).
// Convertible-treasure chances are deliberately much lower than gear
// chances — they're a rare windfall for the town's merchant income, not a
// reliable source.
// Equipment expansion (see data/items.ts): each table's normal-tier drop
// stays as it was, plus one new uncommon/rare-tier addition at a notably
// lower chance — so the new higher tiers are discoverable through combat
// too, not just crafting/the merchant, without a full drop-table rebalance
// (explicitly out of scope for this pass).
const SLIME_DROPS: DropEntry[] = [
  { kind: 'material', materialId: 'herb', amount: 1, chance: 0.25 },
  { kind: 'item', itemId: 'leatherArmor', chance: 0.03 },
  { kind: 'item', itemId: 'bodyTunic', chance: 0.01 },
  { kind: 'item', itemId: 'luckyCharm', chance: 0.01 },
];
const BAT_DROPS: DropEntry[] = [
  { kind: 'material', materialId: 'feather', amount: 1, chance: 0.3 },
  { kind: 'item', itemId: 'rustySword', chance: 0.04 },
  { kind: 'item', itemId: 'bowHeart', chance: 0.015 },
  { kind: 'item', itemId: 'luckyCharm', chance: 0.02 },
];
const WOLF_DROPS: DropEntry[] = [
  { kind: 'material', materialId: 'gem', amount: 1, chance: 0.2 },
  { kind: 'item', itemId: 'rustySword', chance: 0.08 },
  { kind: 'item', itemId: 'swordSilver', chance: 0.025 },
  { kind: 'item', itemId: 'swordFlame', chance: 0.008 },
  { kind: 'item', itemId: 'ancientGem', chance: 0.03 },
  { kind: 'item', itemId: 'goldBar', chance: 0.015 },
  { kind: 'item', itemId: 'royalJewelry', chance: 0.005 },
];

export const ENEMY_DEFS: EnemyDef[] = [
  { id: 'slime_a', name: 'スライム', emoji: '🟢', hp: 30, atk: 3, goldReward: 8, expReward: 5, dropTable: SLIME_DROPS, x: 0.231, y: 0.292 },
  { id: 'slime_b', name: 'スライム', emoji: '🟢', hp: 30, atk: 3, goldReward: 8, expReward: 5, dropTable: SLIME_DROPS, x: 0.16, y: 0.66 },
  { id: 'bat_a', name: 'コウモリ', emoji: '🦇', hp: 25, atk: 4, goldReward: 10, expReward: 7, dropTable: BAT_DROPS, x: 0.55, y: 0.16 },
  { id: 'wolf_a', name: 'オオカミ', emoji: '🐺', hp: 45, atk: 6, goldReward: 16, expReward: 10, dropTable: WOLF_DROPS, x: 0.82, y: 0.34 },
  { id: 'slime_c', name: 'スライム', emoji: '🟢', hp: 30, atk: 3, goldReward: 8, expReward: 5, dropTable: SLIME_DROPS, x: 0.08, y: 0.23 },
  { id: 'bat_b', name: 'コウモリ', emoji: '🦇', hp: 25, atk: 4, goldReward: 10, expReward: 7, dropTable: BAT_DROPS, x: 0.63, y: 0.19 },
  { id: 'wolf_b', name: 'オオカミ', emoji: '🐺', hp: 45, atk: 6, goldReward: 16, expReward: 10, dropTable: WOLF_DROPS, x: 0.75, y: 0.45 },
  // A far-corner "deep zone" extension, only reachable once the town's
  // grown enough to unlock ring-3 land (see townGrid.ts's
  // OUTER_RING_MIN_TOWN_LEVEL) — the adventure field growing alongside the
  // town, not just the buildable grid.
  {
    id: 'wolf_c',
    name: 'オオカミ',
    emoji: '🐺',
    hp: 65,
    atk: 8,
    goldReward: 24,
    expReward: 14,
    dropTable: WOLF_DROPS,
    x: 0.92,
    y: 0.08,
    minTownLevel: 3,
  },
];

export type EnemyStrengthTier = 'weak' | 'normal' | 'strong';

// A rough, relative difficulty rating — real-device request for some way
// to gauge an enemy's strength at a glance, without needing exact numbers.
// Takes hp/atk directly rather than a full EnemyDef/EnemyInstance so
// callers can pass an EnemyInstance's maxHp (its full, undamaged toughness)
// rather than its current (possibly-depleted) hp — the rating shouldn't
// shrink just because a fight's already in progress. atk is weighted
// heavier than hp since it's what actually threatens the player's birds.
export function getEnemyStrengthTier(enemy: { hp: number; atk: number }): EnemyStrengthTier {
  const power = enemy.hp + enemy.atk * 4;
  if (power < 50) return 'weak';
  if (power <= 80) return 'normal';
  return 'strong';
}

// Per-node yield amounts are deliberately small (~40% of an earlier, much
// more generous pass) — a real-device report found a mining-focused bird
// filling its entire BIRD_INVENTORY_CAP (150) in as little as ~12 minutes
// of active play, and an offline catch-up report ("31分で素材986個") showed
// the same pace compounding across all 4 birds at once. The target is
// "tens of minutes of active gathering to approach the cap," not "a few
// minutes" — see OFFLINE_TICKS_PER_GATHER in game/config.ts for the
// per-personality encounter frequency this multiplies against.
export const MINING_NODE_DEFS: MiningNodeDef[] = [
  // Forest — wood, plus its undergrowth (berries/herbs) and birds' feathers.
  { id: 'wood_1', name: '木', resource: 'wood', amount: 3, x: 0.2, y: 0.2 },
  { id: 'wood_2', name: '木', resource: 'wood', amount: 3, x: 0.285, y: 0.237 },
  { id: 'berry_1', name: '木の実', resource: 'berry', amount: 2, x: 0.24, y: 0.24 },
  { id: 'herb_1', name: '薬草', resource: 'herb', amount: 2, x: 0.28, y: 0.14 },
  { id: 'feather_1', name: '羽根', resource: 'feather', amount: 1, x: 0.3, y: 0.18 },
  // Quarry — ore, plus deeper gems and coal seams, upper-right.
  { id: 'ore_1', name: '岩', resource: 'ore', amount: 2, x: 0.72, y: 0.2 },
  { id: 'ore_2', name: '岩', resource: 'ore', amount: 2, x: 0.8, y: 0.28 },
  {
    id: 'gem_1',
    name: '宝石',
    resource: 'gem',
    amount: 1,
    bonusDropTable: [{ kind: 'item', itemId: 'ancientGem', chance: 0.02 }],
    x: 0.78,
    y: 0.18,
  },
  { id: 'coal_1', name: '石炭', resource: 'coal', amount: 2, x: 0.727, y: 0.247 },
  // Damp mushroom patch, lower-left.
  { id: 'mushroom_1', name: 'キノコ', resource: 'mushroom', amount: 2, x: 0.18, y: 0.72 },
  { id: 'mushroom_2', name: 'キノコ', resource: 'mushroom', amount: 2, x: 0.28, y: 0.8 },
  // Lake — fish, pearls, waterweed, around the river/pond leisure spots.
  { id: 'fish_1', name: '魚', resource: 'fish', amount: 2, x: 0.65, y: 0.85 },
  {
    id: 'pearl_1',
    name: '真珠',
    resource: 'pearl',
    amount: 1,
    bonusDropTable: [{ kind: 'item', itemId: 'royalJewelry', chance: 0.01 }],
    x: 0.78,
    y: 0.9,
  },
  { id: 'waterweed_1', name: '水草', resource: 'waterweed', amount: 2, x: 0.521, y: 0.839 },
  // Ruins — relics, magic stones, old coins, around the treasure chest.
  { id: 'relic_1', name: '遺物', resource: 'relic', amount: 1, x: 0.42, y: 0.14 },
  { id: 'magicStone_1', name: '魔石', resource: 'magicStone', amount: 1, x: 0.58, y: 0.1 },
  {
    id: 'oldCoin_1',
    name: '古いコイン',
    resource: 'oldCoin',
    amount: 2,
    bonusDropTable: [{ kind: 'item', itemId: 'goldBar', chance: 0.015 }],
    x: 0.5,
    y: 0.16,
  },
  // Same "deep zone" extension as wolf_c above — a bonus magicStone vein
  // only reachable once the town's ring-3 land is unlocked.
  { id: 'magicStone_2', name: '魔石', resource: 'magicStone', amount: 1, x: 0.85, y: 0.06, minTownLevel: 3 },
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

// Phase 12①("空っぽスタート"): this used to be a fixed set of 8 always-drawn
// decorations (trees/flower beds/ponds) placed the instant a new save
// started, regardless of anything the player had actually done. That
// contradicted the "start from nothing, grow the town yourself" goal — a
// brand new town should show only the town hall and bare land. Decoration
// is now purely a product of the player constructing a 'garden' plot (see
// data/buildingOptions.ts) themselves; nothing is auto-placed anymore. Kept
// as an exported (now permanently empty) array rather than deleted outright
// so WorldMap's existing `.map()` over it stays a harmless no-op instead of
// needing its own removal — see WorldMap.tsx's TOWN_DECOR render block.
export const TOWN_DECOR: { emoji: string; x: number; y: number }[] = [];
